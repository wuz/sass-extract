import sass from 'sass';
import { toColorHex } from './util';
import { serialize } from './serialize';

/**
 * Transform a sassValue into a structured value based on the value type
 */
function makeValue(sassValue) {
  if (sassValue instanceof sass.types.Boolean || sassValue instanceof sass.types.String) {
    return { value: sassValue.getValue() };
  }
  if (sassValue instanceof sass.types.Number) {
    return { value: sassValue.getValue(), unit: sassValue.getUnit() };
  }
  if (sassValue instanceof sass.types.Color) {
    const r = Math.round(sassValue.getR());
    const g = Math.round(sassValue.getG());
    const b = Math.round(sassValue.getB());

    return {
      value: {
        r,
        g,
        b,
        a: sassValue.getA(),
        hex: `#${toColorHex(r)}${toColorHex(g)}${toColorHex(b)}`,
      },
    };
  }
  if (sassValue instanceof sass.types.Null) {
    return { value: null };
  }
  if (sassValue instanceof sass.types.List) {
    const listLength = sassValue.getLength();
    const listValue = [];
    for (let i = 0; i < listLength; i++) {
      listValue.push(createStructuredValue(sassValue.getValue(i)));
    }
    return { value: listValue, separator: sassValue.getSeparator() ? ',' : ' ' };
  }
  if (sassValue instanceof sass.types.Map) {
    const mapLength = sassValue.getLength();
    const mapValue = {};
    for (let i = 0; i < mapLength; i++) {
      // Serialize map keys of arbitrary type for extracted struct
      const serializedKey = serialize(sassValue.getKey(i));
      mapValue[serializedKey] = createStructuredValue(sassValue.getValue(i));
    }
    return { value: mapValue };
  }

  throw new Error(`Unsupported sass variable type '${sassValue.constructor.name}'`);
}

/**
 * Create a structured value definition from a sassValue object
 */
export function createStructuredValue(sassValue) {
  const value = Object.assign(
    {
      type: sassValue.constructor.name,
    },
    makeValue(sassValue)
  );

  return value;
}
