export default (object) => {
  if (typeof object !== 'object' || object.length) return object;

  const newObject = {};

  Object.keys(object).forEach((k) => {
    const split = k.split('_');
    const newName = split.length >= 2 ? `${split[0]}${split[1][0].toUpperCase()}${split[1].substring(1, split[1].length)}` : k;

    if (typeof object[k] === 'object' && object[k] && !object[k].length) {
      newObject[newName] = this.toCamelCase(object[k]);
    } else if (typeof object[k] === 'object' && object[k] && object[k].length) {
      newObject[newName] = object[k].map((i) => {
        if (typeof i === 'object') return this.toCamelCase(i);

        return i;
      });
    } else {
      newObject[newName] = object[k];
    }
  });

  return newObject;
};
