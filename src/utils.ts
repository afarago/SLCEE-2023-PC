//import { DynamoDB } from "aws-sdk";

export function fnSetMapSerializer(_key: any, value: any) {
  if (value && value instanceof Set) return [...value];
  if (value && value instanceof Map) return Object.fromEntries(value);
  return value;
}

// export const dateMarshall = (value: Date): DynamoDB.AttributeValue =>
//   ({ I: value.getTime() } as DynamoDB.AttributeValue);

// export const dateMarshall = (value: Date): DynamoDB.AttributeValue =>
//   ({ I: value.getTime() } as DynamoDB.AttributeValue);
// export const dateMarshall = (value: Date): DynamoDB.AttributeValue =>
//   ({ S: value.toISOString() } as DynamoDB.AttributeValue);

// export const dateUnmarshall = ({ S }: DynamoDB.AttributeValue): Date | undefined =>
//   S ? new Date(S) : undefined;
//   export const ddbDateMarshall = (value: Date): DynamoDB.AttributeValue =>
//   ({ N: value.getTime().toString() } as DynamoDB.AttributeValue);
// export const ddbDateUnmarshall = ({ N }: DynamoDB.AttributeValue): Date | undefined =>
//   N ? new Date(N) : undefined;
