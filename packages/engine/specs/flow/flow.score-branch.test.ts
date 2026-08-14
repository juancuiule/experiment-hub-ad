import { describe, expect, it } from "vitest";
import { startExperiment, traverse } from "@experiment-hub/engine/flow";
import { ExperimentFlow } from "@experiment-hub/engine/types";
import { makeScreen, seq } from "../test-helpers";

// The "score variable" pattern (EXP-4): a compute node's `sum` formula
// derives a score from earlier screen data, and a downstream branch node
// reads it back via `$$computeId.outputKey`. No new node/field type is
// needed — this exercises the compute node + branch node wiring end to end.
function makeCompute(id: string, computations: any[]): ExperimentFlow["nodes"][0] {
  return { id, type: "compute" as const, props: { name: id, computations } };
}

describe("score variable — compute(sum) feeds a branch condition", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s-likert", "likert"),
      makeCompute("score", [
        {
          outputKey: "total",
          formula: {
            type: "sum",
            inputs: ["$$likert.q1", "$$likert.q2", "$$likert.q3"],
          },
        },
      ]),
      {
        id: "branch-score",
        type: "branch",
        props: {
          name: "Score branch",
          branches: [
            {
              id: "high",
              name: "High",
              config: {
                type: "simple",
                operator: "gte",
                dataKey: "$$score.total",
                value: 10,
              },
            },
            {
              id: "low",
              name: "Low",
              config: {
                type: "simple",
                operator: "lt",
                dataKey: "$$score.total",
                value: 10,
              },
            },
          ],
        },
      },
      makeScreen("s-high", "high-screen"),
      makeScreen("s-low", "low-screen"),
    ],
    edges: [
      seq("start", "s-likert"),
      seq("s-likert", "score"),
      seq("score", "branch-score"),
      { type: "branch-condition", from: "branch-score.high", to: "s-high" },
      { type: "branch-condition", from: "branch-score.low", to: "s-low" },
    ],
    screens: [
      { slug: "likert", components: [] },
      { slug: "high-screen", components: [] },
      { slug: "low-screen", components: [] },
    ],
  };

  it("routes to the high-score branch when the summed score meets the threshold", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { q1: 4, q2: 4, q3: 3 }); // total=11 → high
    expect(step.context.data?.["score"]).toEqual({ total: 11 });
    expect(step.context.branches?.["branch-score"]).toBe("high");
    expect((step.state as any).node.id).toBe("s-high");
  });

  it("routes to the low-score branch when the summed score misses the threshold", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { q1: 1, q2: 2, q3: 1 }); // total=4 → low
    expect(step.context.data?.["score"]).toEqual({ total: 4 });
    expect(step.context.branches?.["branch-score"]).toBe("low");
    expect((step.state as any).node.id).toBe("s-low");
  });
});

describe("score variable — compute(lookup) bands a score for branching", () => {
  const flow: ExperimentFlow = {
    nodes: [
      { id: "start", type: "start" },
      makeScreen("s-likert", "likert"),
      makeCompute("score", [
        {
          outputKey: "total",
          formula: { type: "sum", inputs: ["$$likert.q1", "$$likert.q2"] },
        },
        {
          outputKey: "band",
          formula: {
            type: "lookup",
            input: "$total" as any, // within-node $ reference to the prior output
            table: [
              { when: 0, then: "mild" },
              { when: 6, then: "moderate" },
              { when: 12, then: "severe" },
            ],
            default: "none",
          },
        },
      ]),
      {
        id: "branch-band",
        type: "branch",
        props: {
          name: "Band branch",
          branches: [
            {
              id: "severe",
              name: "Severe",
              config: {
                type: "simple",
                operator: "eq",
                dataKey: "$$score.band",
                value: "severe",
              },
            },
          ],
        },
      },
      makeScreen("s-severe", "severe-screen"),
      makeScreen("s-default", "default-screen"),
    ],
    edges: [
      seq("start", "s-likert"),
      seq("s-likert", "score"),
      seq("score", "branch-band"),
      {
        type: "branch-condition",
        from: "branch-band.severe",
        to: "s-severe",
      },
      { type: "branch-default", from: "branch-band", to: "s-default" },
    ],
    screens: [
      { slug: "likert", components: [] },
      { slug: "severe-screen", components: [] },
      { slug: "default-screen", components: [] },
    ],
  };

  it("routes to the severe branch when the banded score matches", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { q1: 7, q2: 6 }); // total=13 → severe
    expect(step.context.data?.["score"]).toEqual({ total: 13, band: "severe" });
    expect((step.state as any).node.id).toBe("s-severe");
  });

  it("falls back to the default branch when the banded score doesn't match", async () => {
    let step = await startExperiment(flow, "start");
    step = await traverse(step, { q1: 1, q2: 1 }); // total=2 → mild
    expect(step.context.data?.["score"]).toEqual({ total: 2, band: "mild" });
    expect((step.state as any).node.id).toBe("s-default");
  });
});
