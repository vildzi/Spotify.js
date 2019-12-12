"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _this = void 0;

var _default = function _default(object) {
  if ((0, _typeof2["default"])(object) !== 'object' || object.length) return object;
  var newObject = {};
  Object.keys(object).forEach(function (k) {
    var split = k.split('_');
    var newName = split.length >= 2 ? "".concat(split[0]).concat(split[1][0].toUpperCase()).concat(split[1].substring(1, split[1].length)) : k;

    if ((0, _typeof2["default"])(object[k]) === 'object' && object[k] && !object[k].length) {
      newObject[newName] = _this.toCamelCase(object[k]);
    } else if ((0, _typeof2["default"])(object[k]) === 'object' && object[k] && object[k].length) {
      newObject[newName] = object[k].map(function (i) {
        if ((0, _typeof2["default"])(i) === 'object') return _this.toCamelCase(i);
        return i;
      });
    } else {
      newObject[newName] = object[k];
    }
  });
  return newObject;
};

exports["default"] = _default;