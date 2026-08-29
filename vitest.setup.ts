import '@testing-library/jest-dom';

// jsdom has no ResizeObserver — required by cmdk (Command) and other Radix-based components.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom does not implement scrollIntoView — required by cmdk's keyboard/selection handling.
Element.prototype.scrollIntoView ??= function scrollIntoView(): void {};
