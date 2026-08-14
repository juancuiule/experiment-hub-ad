import { evaluateCondition, resolveCondition } from '../conditions';
import { Formula } from '../nodes';
import { getValue } from '../resolve';
import { PREFIX, parseRef } from '../tokens';
import { Context, ContextData } from '../types';
import { shuffle } from '../utils';
import { mergeContext } from './context';

// Inside compute formulas, `$name` means "the output named `name` produced
// earlier in this same compute node" — NOT current-screen data. See docs/data-keys.md.
function getFormulaInputValue(
  input: string,
  context: Context,
  nodeOutputs: ContextData,
): any {
  const ref = parseRef(input);
  if (ref?.prefix === PREFIX.SCREEN) return nodeOutputs[ref.path];
  return getValue(input, context);
}

function numericInputs(
  inputs: string[],
  context: Context,
  nodeOutputs: ContextData,
): number[] {
  return inputs.map(
    (inp) => Number(getFormulaInputValue(inp, context, nodeOutputs)) || 0,
  );
}

// Empty input sets yield 0 for every op, including min/max.
function aggregate(
  op: 'sum' | 'mean' | 'min' | 'max',
  values: number[],
): number {
  switch (op) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'mean':
      return values.length === 0
        ? 0
        : values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return values.length === 0 ? 0 : Math.min(...values);
    case 'max':
      return values.length === 0 ? 0 : Math.max(...values);
  }
}

// Loop iteration data nests under the compute node's dataPath (e.g.
// data[pathId][loopId]), so walk dataPath before indexing by loopId.
function resolveDataPath(context: Context, dataPath?: string[]): any {
  return (dataPath ?? []).reduce<any>(
    (obj, key) => (obj == null ? undefined : obj[key]),
    context.data ?? {},
  );
}

export function evaluateFormula(
  formula: Formula,
  context: Context,
  nodeOutputs: Record<string, any>,
  dataPath?: string[],
): any {
  switch (formula.type) {
    case 'sum':
    case 'mean':
    case 'min':
    case 'max':
      return aggregate(
        formula.type,
        numericInputs(formula.inputs, context, nodeOutputs),
      );
    case 'count':
      return formula.inputs.filter((inp) => {
        const val = getFormulaInputValue(inp, context, nodeOutputs);
        if (val == null || val === '') return false;
        if (!formula.where) return true;
        const evalCtx = mergeContext(context, {
          screenData: nodeOutputs,
          loopData: { current: val },
        });
        return evaluateCondition(formula.where, evalCtx);
      }).length;
    case 'conditional': {
      const ctxWithOutputs = mergeContext(context, { screenData: nodeOutputs });
      return evaluateCondition(formula.condition, ctxWithOutputs)
        ? formula.then
        : formula.else;
    }
    case 'lookup': {
      const val = getFormulaInputValue(formula.input, context, nodeOutputs);
      const sorted = [...formula.table].sort(
        (a, b) => Number(b.when) - Number(a.when),
      );
      const match = sorted.find((entry) => Number(val) >= Number(entry.when));
      return match ? match.then : formula.default;
    }
    case 'sample': {
      const pool = Array.isArray(formula.input)
        ? formula.input
        : getFormulaInputValue(formula.input, context, nodeOutputs);
      if (!Array.isArray(pool)) return [];

      const n =
        typeof formula.n === 'number'
          ? formula.n
          : getFormulaInputValue(formula.n, context, nodeOutputs);
      return shuffle(pool).slice(0, n);
    }
    case 'split': {
      const list = Array.isArray(formula.input)
        ? formula.input
        : getFormulaInputValue(formula.input, context, nodeOutputs);
      if (!Array.isArray(list)) return [];

      const n = formula.n;
      if (!Number.isInteger(n) || n <= 0) return [list];

      if (formula.mode === 'size') {
        // size mode: bins of n items; the final bin holds the remainder
        // (n=3 over 10 → [3,3,3,1]).
        const bins: unknown[][] = [];
        for (let i = 0; i < list.length; i += n) {
          bins.push(list.slice(i, i + n));
        }
        return bins;
      }

      // into mode: n bins. Each bin gets `base` items; the trailing `rem` bins
      // get one extra, so the remainder lands in the last bins (n=3 over 10 →
      // [3,3,4]). When n > length, base is 0 and the leading empty bins are
      // dropped (n=3 over 2 → [[a],[b]]); the inline-array overflow case is
      // caught by validation instead.
      const base = Math.floor(list.length / n);
      const rem = list.length - base * n;
      const bins: unknown[][] = [];
      let cursor = 0;
      for (let b = 0; b < n; b++) {
        const take = base + (b >= n - rem ? 1 : 0);
        bins.push(list.slice(cursor, cursor + take));
        cursor += take;
      }
      return bins.filter((bin) => bin.length > 0);
    }
    case 'collect-loop': {
      // Merge every iteration's responses into one flat object. Iterations are
      // read from the loop's published order.
      const order = context.loops?.[formula.loopId]?.order ?? [];
      const loopDataRoot = resolveDataPath(context, dataPath);
      const iterations = loopDataRoot?.[formula.loopId] as
        | Record<string, Record<string, unknown>>
        | undefined;

      const collected: Record<string, unknown> = {};
      for (const iterKey of order) {
        const iterationData = iterations?.[iterKey];
        if (iterationData == null) continue;
        // Scope to the screen slug when given (→ flat field map); otherwise
        // merge the whole iteration object (keeps the screen-slug level).
        const scope =
          formula.screen != null
            ? ((iterationData[formula.screen] as Record<string, unknown>) ?? {})
            : iterationData;
        Object.assign(collected, scope);
      }

      if (formula.omitKeys != null) {
        for (const key of formula.omitKeys) {
          delete collected[key];
        }
      }

      return collected;
    }
    case 'loop-aggregate': {
      // Iterate the loop's own published keys rather than reconstructing them,
      // so static/dynamic loops, plain-string and object items, and itemKey'd
      // loops all behave identically.
      const loopCtx = context.loops?.[formula.loopId];
      const order = loopCtx?.order ?? [];
      const items = loopCtx?.values ?? [];
      // context.loops is keyed absolutely, but the iteration data is dataPath-relative.
      const loopDataRoot = resolveDataPath(context, dataPath);
      const iterations = loopDataRoot?.[formula.loopId] as
        | Record<string, Record<string, Record<string, unknown>>>
        | undefined;

      const collected: number[] = [];
      let count = 0;

      order.forEach((iterKey, i) => {
        const iterationData = iterations?.[iterKey] ?? {};
        // Expose the aggregated loop's current iteration under @<loopId>:
        //   @<loopId>.value[.prop]         → the item
        //   @<loopId>.index                → the iteration index
        //   @<loopId>.<screenSlug>.<field> → a collected response
        // `value`/`index` are reserved; screen slugs sit alongside them. $ keeps
        // resolving to this node's prior outputs (merged as screenData).
        const evalCtx = mergeContext(context, {
          screenData: nodeOutputs,
          loopData: {
            [formula.loopId]: { ...iterationData, value: items[i], index: i },
          } as any,
        });

        if (formula.where) {
          const resolved = resolveCondition(formula.where, evalCtx);
          if (!evaluateCondition(resolved, evalCtx)) return;
        }

        if (formula.op === 'count') {
          count += 1;
        } else if (formula.field != null) {
          collected.push(Number(getValue(formula.field, evalCtx)) || 0);
        }
      });

      if (formula.op === 'count') return count;
      return aggregate(formula.op, collected);
    }
  }
}
