// Class lists shared by the option-style response components. Kept as literal
// strings so Tailwind's scanner still picks every utility up at build time.

export const CHECKBOX_ROOT_CLASS = [
  'border-border-default size-4 rounded-sm border',
  'flex shrink-0 items-center justify-center',
  'data-[state=checked]:bg-content-active data-[state=checked]:border-content-active',
  'cursor-pointer transition duration-75 ease-out active:scale-95',
].join(' ');

export const RADIO_ITEM_CLASS =
  'border-content-secondary data-[state=checked]:border-content-active focus-visible:ring-ring/50 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border transition duration-150 ease-out focus-visible:ring-2 active:scale-90';

export const RADIO_INDICATOR_CLASS = 'bg-content-active h-2 w-2 rounded-full';
