export function fnSetMapSerializer(_key: any, value: any) {
  if (value && value instanceof Set) return [...value];
  if (value && value instanceof Map) return Object.fromEntries(value);
  return value;
}

export function removeProperty(key: any, value: object): object {
  if (!value) return value;

  const { [key as keyof typeof value]: removed, ...rest } = value;
  return rest;
}
