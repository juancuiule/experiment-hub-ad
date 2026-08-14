import { buildFieldSchema } from '@experiment-hub/engine/field-schema';
import { describe, expect, it } from 'vitest';

describe('text-input', () => {
  it('passes a non-empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'field', label: 'Field', required: true },
    });
    expect(schema.safeParse('hello').success).toBe(true);
  });

  it('fails an empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'field', label: 'Field', required: true },
    });
    expect(schema.safeParse('').success).toBe(false);
  });

  it('passes when optional and empty', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'field', label: 'Field', required: false },
    });
    expect(schema.safeParse('').success).toBe(true);
  });

  it('uses custom errorMessage', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'field', label: 'Field', required: true, errorMessage: 'Please fill in' },
    });
    const result = schema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('Please fill in');
  });

  it('enforces minLength', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'field', label: 'Field', minLength: { value: 5 } },
    });
    expect(schema.safeParse('hi').success).toBe(false);
    expect(schema.safeParse('hello').success).toBe(true);
  });

  it('enforces maxLength', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'field', label: 'Field', maxLength: { value: 3 } },
    });
    expect(schema.safeParse('toolong').success).toBe(false);
    expect(schema.safeParse('ok').success).toBe(true);
  });

  it('enforces regex pattern', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'field', label: 'Field', pattern: { value: '^\\d{5}$' } },
    });
    expect(schema.safeParse('abc').success).toBe(false);
    expect(schema.safeParse('12345').success).toBe(true);
  });

  it('uses custom minLength errorMessage', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-input',
      props: { dataKey: 'field', label: 'Field', minLength: { value: 10, errorMessage: 'Too short' } },
    });
    const result = schema.safeParse('hi');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('Too short');
  });
});

describe('text-area', () => {
  it('passes a non-empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-area',
      props: { dataKey: 'bio', label: 'Bio', required: true },
    });
    expect(schema.safeParse('some text').success).toBe(true);
  });

  it('fails an empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-area',
      props: { dataKey: 'bio', label: 'Bio', required: true },
    });
    expect(schema.safeParse('').success).toBe(false);
  });

  it('passes when optional and empty', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'text-area',
      props: { dataKey: 'bio', label: 'Bio', required: false },
    });
    expect(schema.safeParse('').success).toBe(true);
  });
});

describe('date-input', () => {
  it('passes a non-empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'date-input',
      props: { dataKey: 'dob', label: 'DOB', required: true },
    });
    expect(schema.safeParse('2024-01-15').success).toBe(true);
  });

  it('fails an empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'date-input',
      props: { dataKey: 'dob', label: 'DOB', required: true },
    });
    expect(schema.safeParse('').success).toBe(false);
  });

  it('passes when optional and absent', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'date-input',
      props: { dataKey: 'dob', label: 'DOB', required: false },
    });
    expect(schema.safeParse(undefined).success).toBe(true);
  });
});

describe('time-input', () => {
  it('passes a non-empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'time-input',
      props: { dataKey: 'alarm', label: 'Alarm', required: true },
    });
    expect(schema.safeParse('08:30').success).toBe(true);
  });

  it('fails an empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'time-input',
      props: { dataKey: 'alarm', label: 'Alarm', required: true },
    });
    expect(schema.safeParse('').success).toBe(false);
  });

  it('passes when optional and absent', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'time-input',
      props: { dataKey: 'alarm', label: 'Alarm', required: false },
    });
    expect(schema.safeParse(undefined).success).toBe(true);
  });
});

describe('dropdown', () => {
  it('passes a selected option when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'dropdown',
      props: { dataKey: 'color', label: 'Color', options: [], required: true },
    });
    expect(schema.safeParse('red').success).toBe(true);
  });

  it('fails an empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'dropdown',
      props: { dataKey: 'color', label: 'Color', options: [], required: true },
    });
    expect(schema.safeParse('').success).toBe(false);
  });

  it('passes when optional and empty', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'dropdown',
      props: { dataKey: 'color', label: 'Color', options: [], required: false },
    });
    expect(schema.safeParse('').success).toBe(true);
  });
});

describe('radio', () => {
  it('passes a selected option when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'radio',
      props: { dataKey: 'choice', label: 'Choice', options: [], required: true },
    });
    expect(schema.safeParse('yes').success).toBe(true);
  });

  it('fails an empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'radio',
      props: { dataKey: 'choice', label: 'Choice', options: [], required: true },
    });
    expect(schema.safeParse('').success).toBe(false);
  });

  it('passes when optional and empty', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'radio',
      props: { dataKey: 'choice', label: 'Choice', options: [], required: false },
    });
    expect(schema.safeParse('').success).toBe(true);
  });
});

describe('checkboxes', () => {
  it('passes when at least one selected and required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'checkboxes',
      props: { dataKey: 'picks', label: 'Picks', options: [], required: true },
    });
    expect(schema.safeParse(['a']).success).toBe(true);
  });

  it('fails an empty array when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'checkboxes',
      props: { dataKey: 'picks', label: 'Picks', options: [], required: true },
    });
    expect(schema.safeParse([]).success).toBe(false);
  });

  it('enforces min selection count', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'checkboxes',
      props: { dataKey: 'picks', label: 'Picks', options: [], min: 2 },
    });
    expect(schema.safeParse(['a']).success).toBe(false);
    expect(schema.safeParse(['a', 'b']).success).toBe(true);
  });

  it('enforces max selection count', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'checkboxes',
      props: { dataKey: 'picks', label: 'Picks', options: [], max: 2 },
    });
    expect(schema.safeParse(['a', 'b', 'c']).success).toBe(false);
    expect(schema.safeParse(['a', 'b']).success).toBe(true);
  });
});

describe('likert-scale', () => {
  it('passes a selected option when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'likert-scale',
      props: { dataKey: 'score', label: 'Score', options: [], required: true },
    });
    expect(schema.safeParse('3').success).toBe(true);
  });

  it('fails an empty string when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'likert-scale',
      props: { dataKey: 'score', label: 'Score', options: [], required: true },
    });
    expect(schema.safeParse('').success).toBe(false);
  });

  it('passes when optional and absent', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'likert-scale',
      props: { dataKey: 'score', label: 'Score', options: [], required: false },
    });
    expect(schema.safeParse(undefined).success).toBe(true);
  });
});

describe('numeric-input', () => {
  it('passes a number within range', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'age', label: 'Age', min: 0, max: 120 },
    });
    expect(schema.safeParse(30).success).toBe(true);
  });

  it('fails below min', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'age', label: 'Age', min: 0, max: 120 },
    });
    expect(schema.safeParse(-1).success).toBe(false);
  });

  it('fails above max', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'age', label: 'Age', min: 0, max: 120 },
    });
    expect(schema.safeParse(121).success).toBe(false);
  });

  it('coerces string to number', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'age', label: 'Age', min: 0, max: 120 },
    });
    expect(schema.safeParse('42').success).toBe(true);
  });

  it('passes when optional and absent', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'age', label: 'Age', required: false },
    });
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  // Coercion would turn an unanswered field into 0, which is a valid answer.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['NaN', Number.NaN],
  ])('fails when required and the answer is %s', (_label, value) => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'age', label: 'Age' },
    });

    const result = schema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('This field is required');
  });

  it('uses the configured error message when required and unanswered', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'age', label: 'Age', errorMessage: 'Tell us your age' },
    });

    const result = schema.safeParse(null);
    expect(result.error?.issues[0].message).toBe('Tell us your age');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['NaN', Number.NaN],
  ])('keeps an optional unanswered field as null when given %s', (_l, value) => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'age', label: 'Age', required: false, min: 0 },
    });

    const result = schema.safeParse(value);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('still enforces the range on an optional answer', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'numeric-input',
      props: { dataKey: 'age', label: 'Age', required: false, min: 0, max: 120 },
    });

    expect(schema.safeParse(50).success).toBe(true);
    expect(schema.safeParse(-1).success).toBe(false);
  });
});

describe('slider', () => {
  it('passes a value within range', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
    });
    expect(schema.safeParse(50).success).toBe(true);
  });

  it('fails above max', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
    });
    expect(schema.safeParse(101).success).toBe(false);
  });

  it('fails below min', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
    });
    expect(schema.safeParse(-1).success).toBe(false);
  });

  it('coerces string to number', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100 },
    });
    expect(schema.safeParse('75').success).toBe(true);
  });

  it('rejects null when required (slider not touched)', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', required: true },
    });
    expect(schema.safeParse(null).success).toBe(false);
  });

  it('rejects absent value when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', required: true },
    });
    expect(schema.safeParse(undefined).success).toBe(false);
  });

  it('passes 0 when required (0 is a valid interaction)', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', required: true },
    });
    expect(schema.safeParse(0).success).toBe(true);
  });

  it('accepts null when optional (slider not touched)', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', required: false },
    });
    expect(schema.safeParse(null).success).toBe(true);
  });

  it('uses custom errorMessage when required fails', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', required: true, errorMessage: 'Please move the slider' },
    });
    const result = schema.safeParse(null);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('Please move the slider');
  });

  it('enforces minValue constraint', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100, minValue: { value: 20 } },
    });
    expect(schema.safeParse(10).success).toBe(false);
    expect(schema.safeParse(20).success).toBe(true);
  });

  it('enforces maxValue constraint', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'slider',
      props: { dataKey: 'vol', label: 'Volume', min: 0, max: 100, maxValue: { value: 80 } },
    });
    expect(schema.safeParse(81).success).toBe(false);
    expect(schema.safeParse(80).success).toBe(true);
  });
});

describe('range-slider', () => {
  it('passes a valid [lo, hi] tuple within range', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', min: 0, max: 100 },
    });
    expect(schema.safeParse([20, 80]).success).toBe(true);
  });

  it('passes [min, max] boundary values', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', min: 0, max: 100 },
    });
    expect(schema.safeParse([0, 100]).success).toBe(true);
  });

  it('fails when lo > hi', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', min: 0, max: 100 },
    });
    expect(schema.safeParse([80, 20]).success).toBe(false);
  });

  it('passes when lo === hi', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', min: 0, max: 100 },
    });
    expect(schema.safeParse([50, 50]).success).toBe(true);
  });

  it('fails when a value is above max', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', min: 0, max: 100 },
    });
    expect(schema.safeParse([50, 101]).success).toBe(false);
  });

  it('fails when a value is below min', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', min: 0, max: 100 },
    });
    expect(schema.safeParse([-1, 50]).success).toBe(false);
  });

  it('rejects null when required (slider not touched)', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', required: true },
    });
    expect(schema.safeParse(null).success).toBe(false);
  });

  it('rejects undefined when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', required: true },
    });
    expect(schema.safeParse(undefined).success).toBe(false);
  });

  it('accepts null when optional (slider not touched)', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', required: false },
    });
    expect(schema.safeParse(null).success).toBe(true);
  });

  it('uses custom errorMessage when required fails', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range', required: true, errorMessage: 'Please set a range' },
    });
    const result = schema.safeParse(null);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('Please set a range');
  });

  it('uses default min/max (0–100) when not specified', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'range-slider',
      props: { dataKey: 'range', label: 'Range' },
    });
    expect(schema.safeParse([0, 100]).success).toBe(true);
    expect(schema.safeParse([-1, 50]).success).toBe(false);
  });
});

describe('single-checkbox', () => {
  it('passes true when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'single-checkbox',
      props: { dataKey: 'agree', label: 'Agree', defaultValue: false, required: true },
    });
    expect(schema.safeParse(true).success).toBe(true);
  });

  it('fails false when required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'single-checkbox',
      props: { dataKey: 'agree', label: 'Agree', defaultValue: false, required: true },
    });
    expect(schema.safeParse(false).success).toBe(false);
  });

  it('passes false when not required', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'single-checkbox',
      props: { dataKey: 'agree', label: 'Agree', defaultValue: false, required: false },
    });
    expect(schema.safeParse(false).success).toBe(true);
  });

  it('enforces shouldBe: true', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'single-checkbox',
      props: { dataKey: 'tos', label: 'Accept', defaultValue: false, shouldBe: true },
    });
    expect(schema.safeParse(false).success).toBe(false);
    expect(schema.safeParse(true).success).toBe(true);
  });

  it('enforces shouldBe: false', () => {
    const schema = buildFieldSchema({
      componentFamily: 'response',
      template: 'single-checkbox',
      props: { dataKey: 'opt-out', label: 'Opt out', defaultValue: true, shouldBe: false },
    });
    expect(schema.safeParse(true).success).toBe(false);
    expect(schema.safeParse(false).success).toBe(true);
  });
});
