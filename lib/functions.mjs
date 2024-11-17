export function convertNestedKeys(obj) {
  const result = {};
  for (const key in obj) {
    if (typeof obj[key] === "object") {
      const nestedResult = convertNestedKeys(obj[key]);
      for (const nestedKey in nestedResult) {
        result[`${key}.${nestedKey}`] = nestedResult[nestedKey];
      }
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

export function expandDotNotation(obj) {
  const result = {};
  for (const key in obj) {
    const parts = key.split(".");
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    current[parts[parts.length - 1]] = obj[key];
  }
  return result;
}
