import { z } from 'zod';
import { ResponseComponent } from './components/response';

export function buildFieldSchema(component: ResponseComponent): z.ZodTypeAny {
  const { required = true, errorMessage } = component.props;
  const msg = errorMessage ?? 'This field is required';

  switch (component.template) {
    case 'text-input':
    case 'text-area': {
      const { minLength, maxLength, pattern } = component.props;
      let base = z.string();
      if (required) base = base.min(1, msg);
      if (minLength)
        base = base.min(
          minLength.value,
          minLength.errorMessage ??
            `Must be at least ${minLength.value} characters`,
        );
      if (maxLength)
        base = base.max(
          maxLength.value,
          maxLength.errorMessage ??
            `Must be at most ${maxLength.value} characters`,
        );
      if (pattern)
        base = base.regex(
          new RegExp(pattern.value),
          pattern.errorMessage ?? 'Invalid format',
        );
      return required ? base : base.optional();
    }

    case 'date-input':
    case 'time-input': {
      const base = z.string();
      return required ? base.min(1, msg) : base.optional();
    }

    case 'dropdown':
    case 'radio': {
      // TODO: add validation to check that selected options is
      // one of valid ones (component.props.options).
      // This requires option resolution in case of dynamic
      // options reference
      const base = z.string();
      return required ? base.min(1, msg) : base.optional();
    }

    case 'checkboxes': {
      // TODO: add validation to check that selected options are among
      // the valid ones (component.props.options). This requires option
      // resolution in case of dynamic options reference
      const { min, max } = component.props;
      let base = z.array(z.string());
      if (required || (min !== undefined && min > 0)) {
        base = base.min(
          min ?? 1,
          errorMessage ??
            (min !== undefined && min > 1
              ? `Select at least ${min} options`
              : 'Please select at least one option'),
        );
      }
      if (max !== undefined) {
        base = base.max(max, errorMessage ?? `Select at most ${max} options`);
      }
      return base;
    }

    case 'likert-scale': {
      // TODO: add validation to check that selected option is among
      // the valid ones (component.props.options).
      const base = z.string();
      return required ? base.min(1, msg) : base.optional();
    }

    case 'numeric-input': {
      const { min, max } = component.props;
      const buildCoerceBase = () => {
        let base = z.coerce.number();
        if (min !== undefined)
          base = base.min(min, errorMessage ?? `Must be at least ${min}`);
        if (max !== undefined)
          base = base.max(max, errorMessage ?? `Must be at most ${max}`);
        return base;
      };

      // An untouched input is null and an emptied one reports NaN; both must be
      // gated before `z.coerce.number()` silently turns them into 0.
      if (required) {
        return z
          .any()
          .refine((v) => !isBlankNumeric(v), { message: msg })
          .pipe(buildCoerceBase() as z.ZodTypeAny) as z.ZodTypeAny;
      }

      // not required: a blank answer stays null (user didn't answer),
      // but any value that is present must be valid
      return z.preprocess(
        (v) => (isBlankNumeric(v) ? null : v),
        z.union([z.null(), buildCoerceBase()]),
      ) as z.ZodTypeAny;
    }

    case 'slider': {
      const { min = 0, max = 100, minValue, maxValue } = component.props;

      const buildCoerceBase = () => {
        let base = z.coerce.number().min(min).max(max);
        if (minValue)
          base = base.min(
            minValue.value,
            minValue.errorMessage ?? `Must be at least ${minValue.value}`,
          );
        if (maxValue)
          base = base.max(
            maxValue.value,
            maxValue.errorMessage ?? `Must be at most ${maxValue.value}`,
          );
        return base;
      };

      if (required) {
        // required on a slider means: user must have interacted (value must not be null)
        // First gate on null/undefined, then delegate to the coerce chain for range checks.
        return z
          .preprocess(
            (v) => v,
            z
              .any()
              .refine(
                (v) =>
                  v !== undefined && v !== null && Number.isFinite(Number(v)),
                { message: msg },
              ),
          )
          .pipe(buildCoerceBase() as z.ZodTypeAny) as z.ZodTypeAny;
      }

      // not required: null is accepted (user didn't interact),
      // but if a value is present it must be valid
      return z.union([z.null(), buildCoerceBase()]);
    }

    case 'range-slider': {
      const { min = 0, max = 100 } = component.props;
      const pairSchema = z
        .tuple([z.number().min(min).max(max), z.number().min(min).max(max)])
        .refine(([lo, hi]) => lo <= hi, {
          message: 'Lower bound must not exceed upper bound',
        });

      if (required) {
        return z
          .preprocess(
            (v) => v,
            z
              .any()
              .refine((v) => v !== undefined && v !== null && Array.isArray(v), {
                message: msg,
              }),
          )
          .pipe(pairSchema as z.ZodTypeAny) as z.ZodTypeAny;
      }

      return z.union([z.null(), pairSchema]);
    }

    case 'single-checkbox': {
      const { shouldBe } = component.props;
      if (shouldBe !== undefined) {
        return z.boolean().refine((v) => v === shouldBe, {
          message: errorMessage ?? `Must be ${shouldBe}`,
        });
      }
      return required
        ? z.boolean().refine((v) => v === true, { message: msg })
        : z.boolean();
    }
  }
}

// A numeric answer that carries no value: never touched (null/undefined),
// emptied in the DOM (''), or reported as NaN by `valueAsNumber`.
function isBlankNumeric(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return typeof value === 'number' && Number.isNaN(value);
}
