import sass from 'sass';
import { toColorHex } from './util';
import parseColor from 'parse-color';

/**
 * Serialize a given sass color into a color name like 'white', an rgba(r,g,b,a), or #000000 string
 * based on the color provided
 */
function serializeColor(sassColor) {
  const alpha = Math.round(sassColor.getA() * 100) / 100;
  const r = Math.round(sassColor.getR());
  const g = Math.round(sassColor.getG());
  const b = Math.round(sassColor.getB());

  if (alpha < 0.999) {
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const hex = `#${toColorHex(r)}${toColorHex(g)}${toColorHex(b)}`;
  const parsedColor = parseColor(hex);
  if (parsedColor.keyword != null) {
    return parsedColor.keyword;
  }
  return hex;
}

/**
 * Transform a SassValue into a serialized string
 */
function serializeValue(sassValue, isInList) {
  if (sassValue instanceof sass.types.Boolean || sassValue instanceof sass.types.String) {
    return `${sassValue.getValue()}`;
  }
  if (sassValue instanceof sass.types.Number) {
    return `${sassValue.getValue()}${sassValue.getUnit()}`;
  }
  if (sassValue instanceof sass.types.Color) {
    return serializeColor(sassValue);
  }
  if (sassValue instanceof sass.types.Null) {
    return `null`;
  }
  if (sassValue instanceof sass.types.List) {
    const listLength = sassValue.getLength();
    const listElement = [];
    const hasSeparator = sassValue.getSeparator();
    for (let i = 0; i < listLength; i++) {
      listElement.push(serialize(sassValue.getValue(i), true));
    }
    // Make sure nested lists are serialized with surrounding parenthesis
    if (isInList) {
      return `(${listElement.join(hasSeparator ? ',' : ' ')})`;
    }
    return `${listElement.join(hasSeparator ? ',' : ' ')}`;
  }
  if (sassValue instanceof sass.types.Map) {
    const mapLength = sassValue.getLength();
    const mapValue = {};
    for (let i = 0; i < mapLength; i++) {
      const key = serialize(sassValue.getKey(i));
      const value = serialize(sassValue.getValue(i));
      mapValue[key] = value;
    }
    const serializedMapValues = Object.keys(mapValue).map((key) => `${key}: ${mapValue[key]}`);
    return `(${serializedMapValues})`;
  }

  throw new Error(`Unsupported sass variable type '${sassValue.constructor.name}'`);
}

/**
 * Create a serialized string from a sassValue object
 */
export function serialize(sassValue, isInList) {
  return serializeValue(sassValue, isInList);
}
