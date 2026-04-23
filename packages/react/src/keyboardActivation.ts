type KeyboardActivationEvent = {
  key: string;
  preventDefault(): void;
};

export function triggerButtonActionOnKeyDown(
  event: KeyboardActivationEvent,
  action: () => void,
): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}
