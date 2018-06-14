/**!
 * @fileOverview Kickass library to create and place poppers near their reference elements.
 * @version 1.12.9
 * @license
 * Copyright (c) 2016 Federico Zivolo and contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Popper = factory());
}(this, (function () { 'use strict';

var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
var longerTimeoutBrowsers = ['Edge', 'Trident', 'Firefox'];
var timeoutDuration = 0;
for (var i = 0; i < longerTimeoutBrowsers.length; i += 1) {
  if (isBrowser && navigator.userAgent.indexOf(longerTimeoutBrowsers[i]) >= 0) {
    timeoutDuration = 1;
    break;
  }
}

function microtaskDebounce(fn) {
  var called = false;
  return function () {
    if (called) {
      return;
    }
    called = true;
    window.Promise.resolve().then(function () {
      called = false;
      fn();
    });
  };
}

function taskDebounce(fn) {
  var scheduled = false;
  return function () {
    if (!scheduled) {
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        fn();
      }, timeoutDuration);
    }
  };
}

var supportsMicroTasks = isBrowser && window.Promise;

/**
* Create a debounced version of a method, that's asynchronously deferred
* but called in the minimum time possible.
*
* @method
* @memberof Popper.Utils
* @argument {Function} fn
* @returns {Function}
*/
var debounce = supportsMicroTasks ? microtaskDebounce : taskDebounce;

/**
 * Check if the given variable is a function
 * @method
 * @memberof Popper.Utils
 * @argument {Any} functionToCheck - variable to check
 * @returns {Boolean} answer to: is a function?
 */
function isFunction(functionToCheck) {
  var getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

/**
 * Get CSS computed property of the given element
 * @method
 * @memberof Popper.Utils
 * @argument {Eement} element
 * @argument {String} property
 */
function getStyleComputedProperty(element, property) {
  if (element.nodeType !== 1) {
    return [];
  }
  // NOTE: 1 DOM access here
  var css = getComputedStyle(element, null);
  return property ? css[property] : css;
}

/**
 * Returns the parentNode or the host of the element
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @returns {Element} parent
 */
function getParentNode(element) {
  if (element.nodeName === 'HTML') {
    return element;
  }
  return element.parentNode || element.host;
}

/**
 * Returns the scrolling parent of the given element
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @returns {Element} scroll parent
 */
function getScrollParent(element) {
  // Return body, `getScroll` will take care to get the correct `scrollTop` from it
  if (!element) {
    return document.body;
  }

  switch (element.nodeName) {
    case 'HTML':
    case 'BODY':
      return element.ownerDocument.body;
    case '#document':
      return element.body;
  }

  // Firefox want us to check `-x` and `-y` variations as well

  var _getStyleComputedProp = getStyleComputedProperty(element),
      overflow = _getStyleComputedProp.overflow,
      overflowX = _getStyleComputedProp.overflowX,
      overflowY = _getStyleComputedProp.overflowY;

  if (/(auto|scroll)/.test(overflow + overflowY + overflowX)) {
    return element;
  }

  return getScrollParent(getParentNode(element));
}

/**
 * Returns the offset parent of the given element
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @returns {Element} offset parent
 */
function getOffsetParent(element) {
  // NOTE: 1 DOM access here
  var offsetParent = element && element.offsetParent;
  var nodeName = offsetParent && offsetParent.nodeName;

  if (!nodeName || nodeName === 'BODY' || nodeName === 'HTML') {
    if (element) {
      return element.ownerDocument.documentElement;
    }

    return document.documentElement;
  }

  // .offsetParent will return the closest TD or TABLE in case
  // no offsetParent is present, I hate this job...
  if (['TD', 'TABLE'].indexOf(offsetParent.nodeName) !== -1 && getStyleComputedProperty(offsetParent, 'position') === 'static') {
    return getOffsetParent(offsetParent);
  }

  return offsetParent;
}

function isOffsetContainer(element) {
  var nodeName = element.nodeName;

  if (nodeName === 'BODY') {
    return false;
  }
  return nodeName === 'HTML' || getOffsetParent(element.firstElementChild) === element;
}

/**
 * Finds the root node (document, shadowDOM root) of the given element
 * @method
 * @memberof Popper.Utils
 * @argument {Element} node
 * @returns {Element} root node
 */
function getRoot(node) {
  if (node.parentNode !== null) {
    return getRoot(node.parentNode);
  }

  return node;
}

/**
 * Finds the offset parent common to the two provided nodes
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element1
 * @argument {Element} element2
 * @returns {Element} common offset parent
 */
function findCommonOffsetParent(element1, element2) {
  // This check is needed to avoid errors in case one of the elements isn't defined for any reason
  if (!element1 || !element1.nodeType || !element2 || !element2.nodeType) {
    return document.documentElement;
  }

  // Here we make sure to give as "start" the element that comes first in the DOM
  var order = element1.compareDocumentPosition(element2) & Node.DOCUMENT_POSITION_FOLLOWING;
  var start = order ? element1 : element2;
  var end = order ? element2 : element1;

  // Get common ancestor container
  var range = document.createRange();
  range.setStart(start, 0);
  range.setEnd(end, 0);
  var commonAncestorContainer = range.commonAncestorContainer;

  // Both nodes are inside #document

  if (element1 !== commonAncestorContainer && element2 !== commonAncestorContainer || start.contains(end)) {
    if (isOffsetContainer(commonAncestorContainer)) {
      return commonAncestorContainer;
    }

    return getOffsetParent(commonAncestorContainer);
  }

  // one of the nodes is inside shadowDOM, find which one
  var element1root = getRoot(element1);
  if (element1root.host) {
    return findCommonOffsetParent(element1root.host, element2);
  } else {
    return findCommonOffsetParent(element1, getRoot(element2).host);
  }
}

/**
 * Gets the scroll value of the given element in the given side (top and left)
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @argument {String} side `top` or `left`
 * @returns {number} amount of scrolled pixels
 */
function getScroll(element) {
  var side = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'top';

  var upperSide = side === 'top' ? 'scrollTop' : 'scrollLeft';
  var nodeName = element.nodeName;

  if (nodeName === 'BODY' || nodeName === 'HTML') {
    var html = element.ownerDocument.documentElement;
    var scrollingElement = element.ownerDocument.scrollingElement || html;
    return scrollingElement[upperSide];
  }

  return element[upperSide];
}

/*
 * Sum or subtract the element scroll values (left and top) from a given rect object
 * @method
 * @memberof Popper.Utils
 * @param {Object} rect - Rect object you want to change
 * @param {HTMLElement} element - The element from the function reads the scroll values
 * @param {Boolean} subtract - set to true if you want to subtract the scroll values
 * @return {Object} rect - The modifier rect object
 */
function includeScroll(rect, element) {
  var subtract = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  var scrollTop = getScroll(element, 'top');
  var scrollLeft = getScroll(element, 'left');
  var modifier = subtract ? -1 : 1;
  rect.top += scrollTop * modifier;
  rect.bottom += scrollTop * modifier;
  rect.left += scrollLeft * modifier;
  rect.right += scrollLeft * modifier;
  return rect;
}

/*
 * Helper to detect borders of a given element
 * @method
 * @memberof Popper.Utils
 * @param {CSSStyleDeclaration} styles
 * Result of `getStyleComputedProperty` on the given element
 * @param {String} axis - `x` or `y`
 * @return {number} borders - The borders size of the given axis
 */

function getBordersSize(styles, axis) {
  var sideA = axis === 'x' ? 'Left' : 'Top';
  var sideB = sideA === 'Left' ? 'Right' : 'Bottom';

  return parseFloat(styles['border' + sideA + 'Width'], 10) + parseFloat(styles['border' + sideB + 'Width'], 10);
}

/**
 * Tells if you are running Internet Explorer 10
 * @method
 * @memberof Popper.Utils
 * @returns {Boolean} isIE10
 */
var isIE10 = undefined;

var isIE10$1 = function () {
  if (isIE10 === undefined) {
    isIE10 = navigator.appVersion.indexOf('MSIE 10') !== -1;
  }
  return isIE10;
};

function getSize(axis, body, html, computedStyle) {
  return Math.max(body['offset' + axis], body['scroll' + axis], html['client' + axis], html['offset' + axis], html['scroll' + axis], isIE10$1() ? html['offset' + axis] + computedStyle['margin' + (axis === 'Height' ? 'Top' : 'Left')] + computedStyle['margin' + (axis === 'Height' ? 'Bottom' : 'Right')] : 0);
}

function getWindowSizes() {
  var body = document.body;
  var html = document.documentElement;
  var computedStyle = isIE10$1() && getComputedStyle(html);

  return {
    height: getSize('Height', body, html, computedStyle),
    width: getSize('Width', body, html, computedStyle)
  };
}

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();





var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

/**
 * Given element offsets, generate an output similar to getBoundingClientRect
 * @method
 * @memberof Popper.Utils
 * @argument {Object} offsets
 * @returns {Object} ClientRect like output
 */
function getClientRect(offsets) {
  return _extends({}, offsets, {
    right: offsets.left + offsets.width,
    bottom: offsets.top + offsets.height
  });
}

/**
 * Get bounding client rect of given element
 * @method
 * @memberof Popper.Utils
 * @param {HTMLElement} element
 * @return {Object} client rect
 */
function getBoundingClientRect(element) {
  var rect = {};

  // IE10 10 FIX: Please, don't ask, the element isn't
  // considered in DOM in some circumstances...
  // This isn't reproducible in IE10 compatibility mode of IE11
  if (isIE10$1()) {
    try {
      rect = element.getBoundingClientRect();
      var scrollTop = getScroll(element, 'top');
      var scrollLeft = getScroll(element, 'left');
      rect.top += scrollTop;
      rect.left += scrollLeft;
      rect.bottom += scrollTop;
      rect.right += scrollLeft;
    } catch (err) {}
  } else {
    rect = element.getBoundingClientRect();
  }

  var result = {
    left: rect.left,
    top: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top
  };

  // subtract scrollbar size from sizes
  var sizes = element.nodeName === 'HTML' ? getWindowSizes() : {};
  var width = sizes.width || element.clientWidth || result.right - result.left;
  var height = sizes.height || element.clientHeight || result.bottom - result.top;

  var horizScrollbar = element.offsetWidth - width;
  var vertScrollbar = element.offsetHeight - height;

  // if an hypothetical scrollbar is detected, we must be sure it's not a `border`
  // we make this check conditional for performance reasons
  if (horizScrollbar || vertScrollbar) {
    var styles = getStyleComputedProperty(element);
    horizScrollbar -= getBordersSize(styles, 'x');
    vertScrollbar -= getBordersSize(styles, 'y');

    result.width -= horizScrollbar;
    result.height -= vertScrollbar;
  }

  return getClientRect(result);
}

function getOffsetRectRelativeToArbitraryNode(children, parent) {
  var isIE10 = isIE10$1();
  var isHTML = parent.nodeName === 'HTML';
  var childrenRect = getBoundingClientRect(children);
  var parentRect = getBoundingClientRect(parent);
  var scrollParent = getScrollParent(children);

  var styles = getStyleComputedProperty(parent);
  var borderTopWidth = parseFloat(styles.borderTopWidth, 10);
  var borderLeftWidth = parseFloat(styles.borderLeftWidth, 10);

  var offsets = getClientRect({
    top: childrenRect.top - parentRect.top - borderTopWidth,
    left: childrenRect.left - parentRect.left - borderLeftWidth,
    width: childrenRect.width,
    height: childrenRect.height
  });
  offsets.marginTop = 0;
  offsets.marginLeft = 0;

  // Subtract margins of documentElement in case it's being used as parent
  // we do this only on HTML because it's the only element that behaves
  // differently when margins are applied to it. The margins are included in
  // the box of the documentElement, in the other cases not.
  if (!isIE10 && isHTML) {
    var marginTop = parseFloat(styles.marginTop, 10);
    var marginLeft = parseFloat(styles.marginLeft, 10);

    offsets.top -= borderTopWidth - marginTop;
    offsets.bottom -= borderTopWidth - marginTop;
    offsets.left -= borderLeftWidth - marginLeft;
    offsets.right -= borderLeftWidth - marginLeft;

    // Attach marginTop and marginLeft because in some circumstances we may need them
    offsets.marginTop = marginTop;
    offsets.marginLeft = marginLeft;
  }

  if (isIE10 ? parent.contains(scrollParent) : parent === scrollParent && scrollParent.nodeName !== 'BODY') {
    offsets = includeScroll(offsets, parent);
  }

  return offsets;
}

function getViewportOffsetRectRelativeToArtbitraryNode(element) {
  var html = element.ownerDocument.documentElement;
  var relativeOffset = getOffsetRectRelativeToArbitraryNode(element, html);
  var width = Math.max(html.clientWidth, window.innerWidth || 0);
  var height = Math.max(html.clientHeight, window.innerHeight || 0);

  var scrollTop = getScroll(html);
  var scrollLeft = getScroll(html, 'left');

  var offset = {
    top: scrollTop - relativeOffset.top + relativeOffset.marginTop,
    left: scrollLeft - relativeOffset.left + relativeOffset.marginLeft,
    width: width,
    height: height
  };

  return getClientRect(offset);
}

/**
 * Check if the given element is fixed or is inside a fixed parent
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @argument {Element} customContainer
 * @returns {Boolean} answer to "isFixed?"
 */
function isFixed(element) {
  var nodeName = element.nodeName;
  if (nodeName === 'BODY' || nodeName === 'HTML') {
    return false;
  }
  if (getStyleComputedProperty(element, 'position') === 'fixed') {
    return true;
  }
  return isFixed(getParentNode(element));
}

/**
 * Computed the boundaries limits and return them
 * @method
 * @memberof Popper.Utils
 * @param {HTMLElement} popper
 * @param {HTMLElement} reference
 * @param {number} padding
 * @param {HTMLElement} boundariesElement - Element used to define the boundaries
 * @returns {Object} Coordinates of the boundaries
 */
function getBoundaries(popper, reference, padding, boundariesElement) {
  // NOTE: 1 DOM access here
  var boundaries = { top: 0, left: 0 };
  var offsetParent = findCommonOffsetParent(popper, reference);

  // Handle viewport case
  if (boundariesElement === 'viewport') {
    boundaries = getViewportOffsetRectRelativeToArtbitraryNode(offsetParent);
  } else {
    // Handle other cases based on DOM element used as boundaries
    var boundariesNode = void 0;
    if (boundariesElement === 'scrollParent') {
      boundariesNode = getScrollParent(getParentNode(reference));
      if (boundariesNode.nodeName === 'BODY') {
        boundariesNode = popper.ownerDocument.documentElement;
      }
    } else if (boundariesElement === 'window') {
      boundariesNode = popper.ownerDocument.documentElement;
    } else {
      boundariesNode = boundariesElement;
    }

    var offsets = getOffsetRectRelativeToArbitraryNode(boundariesNode, offsetParent);

    // In case of HTML, we need a different computation
    if (boundariesNode.nodeName === 'HTML' && !isFixed(offsetParent)) {
      var _getWindowSizes = getWindowSizes(),
          height = _getWindowSizes.height,
          width = _getWindowSizes.width;

      boundaries.top += offsets.top - offsets.marginTop;
      boundaries.bottom = height + offsets.top;
      boundaries.left += offsets.left - offsets.marginLeft;
      boundaries.right = width + offsets.left;
    } else {
      // for all the other DOM elements, this one is good
      boundaries = offsets;
    }
  }

  // Add paddings
  boundaries.left += padding;
  boundaries.top += padding;
  boundaries.right -= padding;
  boundaries.bottom -= padding;

  return boundaries;
}

function getArea(_ref) {
  var width = _ref.width,
      height = _ref.height;

  return width * height;
}

/**
 * Utility used to transform the `auto` placement to the placement with more
 * available space.
 * @method
 * @memberof Popper.Utils
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function computeAutoPlacement(placement, refRect, popper, reference, boundariesElement) {
  var padding = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : 0;

  if (placement.indexOf('auto') === -1) {
    return placement;
  }

  var boundaries = getBoundaries(popper, reference, padding, boundariesElement);

  var rects = {
    top: {
      width: boundaries.width,
      height: refRect.top - boundaries.top
    },
    right: {
      width: boundaries.right - refRect.right,
      height: boundaries.height
    },
    bottom: {
      width: boundaries.width,
      height: boundaries.bottom - refRect.bottom
    },
    left: {
      width: refRect.left - boundaries.left,
      height: boundaries.height
    }
  };

  var sortedAreas = Object.keys(rects).map(function (key) {
    return _extends({
      key: key
    }, rects[key], {
      area: getArea(rects[key])
    });
  }).sort(function (a, b) {
    return b.area - a.area;
  });

  var filteredAreas = sortedAreas.filter(function (_ref2) {
    var width = _ref2.width,
        height = _ref2.height;
    return width >= popper.clientWidth && height >= popper.clientHeight;
  });

  var computedPlacement = filteredAreas.length > 0 ? filteredAreas[0].key : sortedAreas[0].key;

  var variation = placement.split('-')[1];

  return computedPlacement + (variation ? '-' + variation : '');
}

/**
 * Get offsets to the reference element
 * @method
 * @memberof Popper.Utils
 * @param {Object} state
 * @param {Element} popper - the popper element
 * @param {Element} reference - the reference element (the popper will be relative to this)
 * @returns {Object} An object containing the offsets which will be applied to the popper
 */
function getReferenceOffsets(state, popper, reference) {
  var commonOffsetParent = findCommonOffsetParent(popper, reference);
  return getOffsetRectRelativeToArbitraryNode(reference, commonOffsetParent);
}

/**
 * Get the outer sizes of the given element (offset size + margins)
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element
 * @returns {Object} object containing width and height properties
 */
function getOuterSizes(element) {
  var styles = getComputedStyle(element);
  var x = parseFloat(styles.marginTop) + parseFloat(styles.marginBottom);
  var y = parseFloat(styles.marginLeft) + parseFloat(styles.marginRight);
  var result = {
    width: element.offsetWidth + y,
    height: element.offsetHeight + x
  };
  return result;
}

/**
 * Get the opposite placement of the given one
 * @method
 * @memberof Popper.Utils
 * @argument {String} placement
 * @returns {String} flipped placement
 */
function getOppositePlacement(placement) {
  var hash = { left: 'right', right: 'left', bottom: 'top', top: 'bottom' };
  return placement.replace(/left|right|bottom|top/g, function (matched) {
    return hash[matched];
  });
}

/**
 * Get offsets to the popper
 * @method
 * @memberof Popper.Utils
 * @param {Object} position - CSS position the Popper will get applied
 * @param {HTMLElement} popper - the popper element
 * @param {Object} referenceOffsets - the reference offsets (the popper will be relative to this)
 * @param {String} placement - one of the valid placement options
 * @returns {Object} popperOffsets - An object containing the offsets which will be applied to the popper
 */
function getPopperOffsets(popper, referenceOffsets, placement) {
  placement = placement.split('-')[0];

  // Get popper node sizes
  var popperRect = getOuterSizes(popper);

  // Add position, width and height to our offsets object
  var popperOffsets = {
    width: popperRect.width,
    height: popperRect.height
  };

  // depending by the popper placement we have to compute its offsets slightly differently
  var isHoriz = ['right', 'left'].indexOf(placement) !== -1;
  var mainSide = isHoriz ? 'top' : 'left';
  var secondarySide = isHoriz ? 'left' : 'top';
  var measurement = isHoriz ? 'height' : 'width';
  var secondaryMeasurement = !isHoriz ? 'height' : 'width';

  popperOffsets[mainSide] = referenceOffsets[mainSide] + referenceOffsets[measurement] / 2 - popperRect[measurement] / 2;
  if (placement === secondarySide) {
    popperOffsets[secondarySide] = referenceOffsets[secondarySide] - popperRect[secondaryMeasurement];
  } else {
    popperOffsets[secondarySide] = referenceOffsets[getOppositePlacement(secondarySide)];
  }

  return popperOffsets;
}

/**
 * Mimics the `find` method of Array
 * @method
 * @memberof Popper.Utils
 * @argument {Array} arr
 * @argument prop
 * @argument value
 * @returns index or -1
 */
function find(arr, check) {
  // use native find if supported
  if (Array.prototype.find) {
    return arr.find(check);
  }

  // use `filter` to obtain the same behavior of `find`
  return arr.filter(check)[0];
}

/**
 * Return the index of the matching object
 * @method
 * @memberof Popper.Utils
 * @argument {Array} arr
 * @argument prop
 * @argument value
 * @returns index or -1
 */
function findIndex(arr, prop, value) {
  // use native findIndex if supported
  if (Array.prototype.findIndex) {
    return arr.findIndex(function (cur) {
      return cur[prop] === value;
    });
  }

  // use `find` + `indexOf` if `findIndex` isn't supported
  var match = find(arr, function (obj) {
    return obj[prop] === value;
  });
  return arr.indexOf(match);
}

/**
 * Loop trough the list of modifiers and run them in order,
 * each of them will then edit the data object.
 * @method
 * @memberof Popper.Utils
 * @param {dataObject} data
 * @param {Array} modifiers
 * @param {String} ends - Optional modifier name used as stopper
 * @returns {dataObject}
 */
function runModifiers(modifiers, data, ends) {
  var modifiersToRun = ends === undefined ? modifiers : modifiers.slice(0, findIndex(modifiers, 'name', ends));

  modifiersToRun.forEach(function (modifier) {
    if (modifier['function']) {
      // eslint-disable-line dot-notation
      console.warn('`modifier.function` is deprecated, use `modifier.fn`!');
    }
    var fn = modifier['function'] || modifier.fn; // eslint-disable-line dot-notation
    if (modifier.enabled && isFunction(fn)) {
      // Add properties to offsets to make them a complete clientRect object
      // we do this before each modifier to make sure the previous one doesn't
      // mess with these values
      data.offsets.popper = getClientRect(data.offsets.popper);
      data.offsets.reference = getClientRect(data.offsets.reference);

      data = fn(data, modifier);
    }
  });

  return data;
}

/**
 * Updates the position of the popper, computing the new offsets and applying
 * the new style.<br />
 * Prefer `scheduleUpdate` over `update` because of performance reasons.
 * @method
 * @memberof Popper
 */
function update() {
  // if popper is destroyed, don't perform any further update
  if (this.state.isDestroyed) {
    return;
  }

  var data = {
    instance: this,
    styles: {},
    arrowStyles: {},
    attributes: {},
    flipped: false,
    offsets: {}
  };

  // compute reference element offsets
  data.offsets.reference = getReferenceOffsets(this.state, this.popper, this.reference);

  // compute auto placement, store placement inside the data object,
  // modifiers will be able to edit `placement` if needed
  // and refer to originalPlacement to know the original value
  data.placement = computeAutoPlacement(this.options.placement, data.offsets.reference, this.popper, this.reference, this.options.modifiers.flip.boundariesElement, this.options.modifiers.flip.padding);

  // store the computed placement inside `originalPlacement`
  data.originalPlacement = data.placement;

  // compute the popper offsets
  data.offsets.popper = getPopperOffsets(this.popper, data.offsets.reference, data.placement);
  data.offsets.popper.position = 'absolute';

  // run the modifiers
  data = runModifiers(this.modifiers, data);

  // the first `update` will call `onCreate` callback
  // the other ones will call `onUpdate` callback
  if (!this.state.isCreated) {
    this.state.isCreated = true;
    this.options.onCreate(data);
  } else {
    this.options.onUpdate(data);
  }
}

/**
 * Helper used to know if the given modifier is enabled.
 * @method
 * @memberof Popper.Utils
 * @returns {Boolean}
 */
function isModifierEnabled(modifiers, modifierName) {
  return modifiers.some(function (_ref) {
    var name = _ref.name,
        enabled = _ref.enabled;
    return enabled && name === modifierName;
  });
}

/**
 * Get the prefixed supported property name
 * @method
 * @memberof Popper.Utils
 * @argument {String} property (camelCase)
 * @returns {String} prefixed property (camelCase or PascalCase, depending on the vendor prefix)
 */
function getSupportedPropertyName(property) {
  var prefixes = [false, 'ms', 'Webkit', 'Moz', 'O'];
  var upperProp = property.charAt(0).toUpperCase() + property.slice(1);

  for (var i = 0; i < prefixes.length - 1; i++) {
    var prefix = prefixes[i];
    var toCheck = prefix ? '' + prefix + upperProp : property;
    if (typeof document.body.style[toCheck] !== 'undefined') {
      return toCheck;
    }
  }
  return null;
}

/**
 * Destroy the popper
 * @method
 * @memberof Popper
 */
function destroy() {
  this.state.isDestroyed = true;

  // touch DOM only if `applyStyle` modifier is enabled
  if (isModifierEnabled(this.modifiers, 'applyStyle')) {
    this.popper.removeAttribute('x-placement');
    this.popper.style.left = '';
    this.popper.style.position = '';
    this.popper.style.top = '';
    this.popper.style[getSupportedPropertyName('transform')] = '';
  }

  this.disableEventListeners();

  // remove the popper if user explicity asked for the deletion on destroy
  // do not use `remove` because IE11 doesn't support it
  if (this.options.removeOnDestroy) {
    this.popper.parentNode.removeChild(this.popper);
  }
  return this;
}

/**
 * Get the window associated with the element
 * @argument {Element} element
 * @returns {Window}
 */
function getWindow(element) {
  var ownerDocument = element.ownerDocument;
  return ownerDocument ? ownerDocument.defaultView : window;
}

function attachToScrollParents(scrollParent, event, callback, scrollParents) {
  var isBody = scrollParent.nodeName === 'BODY';
  var target = isBody ? scrollParent.ownerDocument.defaultView : scrollParent;
  target.addEventListener(event, callback, { passive: true });

  if (!isBody) {
    attachToScrollParents(getScrollParent(target.parentNode), event, callback, scrollParents);
  }
  scrollParents.push(target);
}

/**
 * Setup needed event listeners used to update the popper position
 * @method
 * @memberof Popper.Utils
 * @private
 */
function setupEventListeners(reference, options, state, updateBound) {
  // Resize event listener on window
  state.updateBound = updateBound;
  getWindow(reference).addEventListener('resize', state.updateBound, { passive: true });

  // Scroll event listener on scroll parents
  var scrollElement = getScrollParent(reference);
  attachToScrollParents(scrollElement, 'scroll', state.updateBound, state.scrollParents);
  state.scrollElement = scrollElement;
  state.eventsEnabled = true;

  return state;
}

/**
 * It will add resize/scroll events and start recalculating
 * position of the popper element when they are triggered.
 * @method
 * @memberof Popper
 */
function enableEventListeners() {
  if (!this.state.eventsEnabled) {
    this.state = setupEventListeners(this.reference, this.options, this.state, this.scheduleUpdate);
  }
}

/**
 * Remove event listeners used to update the popper position
 * @method
 * @memberof Popper.Utils
 * @private
 */
function removeEventListeners(reference, state) {
  // Remove resize event listener on window
  getWindow(reference).removeEventListener('resize', state.updateBound);

  // Remove scroll event listener on scroll parents
  state.scrollParents.forEach(function (target) {
    target.removeEventListener('scroll', state.updateBound);
  });

  // Reset state
  state.updateBound = null;
  state.scrollParents = [];
  state.scrollElement = null;
  state.eventsEnabled = false;
  return state;
}

/**
 * It will remove resize/scroll events and won't recalculate popper position
 * when they are triggered. It also won't trigger onUpdate callback anymore,
 * unless you call `update` method manually.
 * @method
 * @memberof Popper
 */
function disableEventListeners() {
  if (this.state.eventsEnabled) {
    cancelAnimationFrame(this.scheduleUpdate);
    this.state = removeEventListeners(this.reference, this.state);
  }
}

/**
 * Tells if a given input is a number
 * @method
 * @memberof Popper.Utils
 * @param {*} input to check
 * @return {Boolean}
 */
function isNumeric(n) {
  return n !== '' && !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * Set the style to the given popper
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element - Element to apply the style to
 * @argument {Object} styles
 * Object with a list of properties and values which will be applied to the element
 */
function setStyles(element, styles) {
  Object.keys(styles).forEach(function (prop) {
    var unit = '';
    // add unit if the value is numeric and is one of the following
    if (['width', 'height', 'top', 'right', 'bottom', 'left'].indexOf(prop) !== -1 && isNumeric(styles[prop])) {
      unit = 'px';
    }
    element.style[prop] = styles[prop] + unit;
  });
}

/**
 * Set the attributes to the given popper
 * @method
 * @memberof Popper.Utils
 * @argument {Element} element - Element to apply the attributes to
 * @argument {Object} styles
 * Object with a list of properties and values which will be applied to the element
 */
function setAttributes(element, attributes) {
  Object.keys(attributes).forEach(function (prop) {
    var value = attributes[prop];
    if (value !== false) {
      element.setAttribute(prop, attributes[prop]);
    } else {
      element.removeAttribute(prop);
    }
  });
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} data.styles - List of style properties - values to apply to popper element
 * @argument {Object} data.attributes - List of attribute properties - values to apply to popper element
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The same data object
 */
function applyStyle(data) {
  // any property present in `data.styles` will be applied to the popper,
  // in this way we can make the 3rd party modifiers add custom styles to it
  // Be aware, modifiers could override the properties defined in the previous
  // lines of this modifier!
  setStyles(data.instance.popper, data.styles);

  // any property present in `data.attributes` will be applied to the popper,
  // they will be set as HTML attributes of the element
  setAttributes(data.instance.popper, data.attributes);

  // if arrowElement is defined and arrowStyles has some properties
  if (data.arrowElement && Object.keys(data.arrowStyles).length) {
    setStyles(data.arrowElement, data.arrowStyles);
  }

  return data;
}

/**
 * Set the x-placement attribute before everything else because it could be used
 * to add margins to the popper margins needs to be calculated to get the
 * correct popper offsets.
 * @method
 * @memberof Popper.modifiers
 * @param {HTMLElement} reference - The reference element used to position the popper
 * @param {HTMLElement} popper - The HTML element used as popper.
 * @param {Object} options - Popper.js options
 */
function applyStyleOnLoad(reference, popper, options, modifierOptions, state) {
  // compute reference element offsets
  var referenceOffsets = getReferenceOffsets(state, popper, reference);

  // compute auto placement, store placement inside the data object,
  // modifiers will be able to edit `placement` if needed
  // and refer to originalPlacement to know the original value
  var placement = computeAutoPlacement(options.placement, referenceOffsets, popper, reference, options.modifiers.flip.boundariesElement, options.modifiers.flip.padding);

  popper.setAttribute('x-placement', placement);

  // Apply `position` to popper before anything else because
  // without the position applied we can't guarantee correct computations
  setStyles(popper, { position: 'absolute' });

  return options;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function computeStyle(data, options) {
  var x = options.x,
      y = options.y;
  var popper = data.offsets.popper;

  // Remove this legacy support in Popper.js v2

  var legacyGpuAccelerationOption = find(data.instance.modifiers, function (modifier) {
    return modifier.name === 'applyStyle';
  }).gpuAcceleration;
  if (legacyGpuAccelerationOption !== undefined) {
    console.warn('WARNING: `gpuAcceleration` option moved to `computeStyle` modifier and will not be supported in future versions of Popper.js!');
  }
  var gpuAcceleration = legacyGpuAccelerationOption !== undefined ? legacyGpuAccelerationOption : options.gpuAcceleration;

  var offsetParent = getOffsetParent(data.instance.popper);
  var offsetParentRect = getBoundingClientRect(offsetParent);

  // Styles
  var styles = {
    position: popper.position
  };

  // floor sides to avoid blurry text
  var offsets = {
    left: Math.floor(popper.left),
    top: Math.floor(popper.top),
    bottom: Math.floor(popper.bottom),
    right: Math.floor(popper.right)
  };

  var sideA = x === 'bottom' ? 'top' : 'bottom';
  var sideB = y === 'right' ? 'left' : 'right';

  // if gpuAcceleration is set to `true` and transform is supported,
  //  we use `translate3d` to apply the position to the popper we
  // automatically use the supported prefixed version if needed
  var prefixedProperty = getSupportedPropertyName('transform');

  // now, let's make a step back and look at this code closely (wtf?)
  // If the content of the popper grows once it's been positioned, it
  // may happen that the popper gets misplaced because of the new content
  // overflowing its reference element
  // To avoid this problem, we provide two options (x and y), which allow
  // the consumer to define the offset origin.
  // If we position a popper on top of a reference element, we can set
  // `x` to `top` to make the popper grow towards its top instead of
  // its bottom.
  var left = void 0,
      top = void 0;
  if (sideA === 'bottom') {
    top = -offsetParentRect.height + offsets.bottom;
  } else {
    top = offsets.top;
  }
  if (sideB === 'right') {
    left = -offsetParentRect.width + offsets.right;
  } else {
    left = offsets.left;
  }
  if (gpuAcceleration && prefixedProperty) {
    styles[prefixedProperty] = 'translate3d(' + left + 'px, ' + top + 'px, 0)';
    styles[sideA] = 0;
    styles[sideB] = 0;
    styles.willChange = 'transform';
  } else {
    // othwerise, we use the standard `top`, `left`, `bottom` and `right` properties
    var invertTop = sideA === 'bottom' ? -1 : 1;
    var invertLeft = sideB === 'right' ? -1 : 1;
    styles[sideA] = top * invertTop;
    styles[sideB] = left * invertLeft;
    styles.willChange = sideA + ', ' + sideB;
  }

  // Attributes
  var attributes = {
    'x-placement': data.placement
  };

  // Update `data` attributes, styles and arrowStyles
  data.attributes = _extends({}, attributes, data.attributes);
  data.styles = _extends({}, styles, data.styles);
  data.arrowStyles = _extends({}, data.offsets.arrow, data.arrowStyles);

  return data;
}

/**
 * Helper used to know if the given modifier depends from another one.<br />
 * It checks if the needed modifier is listed and enabled.
 * @method
 * @memberof Popper.Utils
 * @param {Array} modifiers - list of modifiers
 * @param {String} requestingName - name of requesting modifier
 * @param {String} requestedName - name of requested modifier
 * @returns {Boolean}
 */
function isModifierRequired(modifiers, requestingName, requestedName) {
  var requesting = find(modifiers, function (_ref) {
    var name = _ref.name;
    return name === requestingName;
  });

  var isRequired = !!requesting && modifiers.some(function (modifier) {
    return modifier.name === requestedName && modifier.enabled && modifier.order < requesting.order;
  });

  if (!isRequired) {
    var _requesting = '`' + requestingName + '`';
    var requested = '`' + requestedName + '`';
    console.warn(requested + ' modifier is required by ' + _requesting + ' modifier in order to work, be sure to include it before ' + _requesting + '!');
  }
  return isRequired;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function arrow(data, options) {
  var _data$offsets$arrow;

  // arrow depends on keepTogether in order to work
  if (!isModifierRequired(data.instance.modifiers, 'arrow', 'keepTogether')) {
    return data;
  }

  var arrowElement = options.element;

  // if arrowElement is a string, suppose it's a CSS selector
  if (typeof arrowElement === 'string') {
    arrowElement = data.instance.popper.querySelector(arrowElement);

    // if arrowElement is not found, don't run the modifier
    if (!arrowElement) {
      return data;
    }
  } else {
    // if the arrowElement isn't a query selector we must check that the
    // provided DOM node is child of its popper node
    if (!data.instance.popper.contains(arrowElement)) {
      console.warn('WARNING: `arrow.element` must be child of its popper element!');
      return data;
    }
  }

  var placement = data.placement.split('-')[0];
  var _data$offsets = data.offsets,
      popper = _data$offsets.popper,
      reference = _data$offsets.reference;

  var isVertical = ['left', 'right'].indexOf(placement) !== -1;

  var len = isVertical ? 'height' : 'width';
  var sideCapitalized = isVertical ? 'Top' : 'Left';
  var side = sideCapitalized.toLowerCase();
  var altSide = isVertical ? 'left' : 'top';
  var opSide = isVertical ? 'bottom' : 'right';
  var arrowElementSize = getOuterSizes(arrowElement)[len];

  //
  // extends keepTogether behavior making sure the popper and its
  // reference have enough pixels in conjuction
  //

  // top/left side
  if (reference[opSide] - arrowElementSize < popper[side]) {
    data.offsets.popper[side] -= popper[side] - (reference[opSide] - arrowElementSize);
  }
  // bottom/right side
  if (reference[side] + arrowElementSize > popper[opSide]) {
    data.offsets.popper[side] += reference[side] + arrowElementSize - popper[opSide];
  }
  data.offsets.popper = getClientRect(data.offsets.popper);

  // compute center of the popper
  var center = reference[side] + reference[len] / 2 - arrowElementSize / 2;

  // Compute the sideValue using the updated popper offsets
  // take popper margin in account because we don't have this info available
  var css = getStyleComputedProperty(data.instance.popper);
  var popperMarginSide = parseFloat(css['margin' + sideCapitalized], 10);
  var popperBorderSide = parseFloat(css['border' + sideCapitalized + 'Width'], 10);
  var sideValue = center - data.offsets.popper[side] - popperMarginSide - popperBorderSide;

  // prevent arrowElement from being placed not contiguously to its popper
  sideValue = Math.max(Math.min(popper[len] - arrowElementSize, sideValue), 0);

  data.arrowElement = arrowElement;
  data.offsets.arrow = (_data$offsets$arrow = {}, defineProperty(_data$offsets$arrow, side, Math.round(sideValue)), defineProperty(_data$offsets$arrow, altSide, ''), _data$offsets$arrow);

  return data;
}

/**
 * Get the opposite placement variation of the given one
 * @method
 * @memberof Popper.Utils
 * @argument {String} placement variation
 * @returns {String} flipped placement variation
 */
function getOppositeVariation(variation) {
  if (variation === 'end') {
    return 'start';
  } else if (variation === 'start') {
    return 'end';
  }
  return variation;
}

/**
 * List of accepted placements to use as values of the `placement` option.<br />
 * Valid placements are:
 * - `auto`
 * - `top`
 * - `right`
 * - `bottom`
 * - `left`
 *
 * Each placement can have a variation from this list:
 * - `-start`
 * - `-end`
 *
 * Variations are interpreted easily if you think of them as the left to right
 * written languages. Horizontally (`top` and `bottom`), `start` is left and `end`
 * is right.<br />
 * Vertically (`left` and `right`), `start` is top and `end` is bottom.
 *
 * Some valid examples are:
 * - `top-end` (on top of reference, right aligned)
 * - `right-start` (on right of reference, top aligned)
 * - `bottom` (on bottom, centered)
 * - `auto-right` (on the side with more space available, alignment depends by placement)
 *
 * @static
 * @type {Array}
 * @enum {String}
 * @readonly
 * @method placements
 * @memberof Popper
 */
var placements = ['auto-start', 'auto', 'auto-end', 'top-start', 'top', 'top-end', 'right-start', 'right', 'right-end', 'bottom-end', 'bottom', 'bottom-start', 'left-end', 'left', 'left-start'];

// Get rid of `auto` `auto-start` and `auto-end`
var validPlacements = placements.slice(3);

/**
 * Given an initial placement, returns all the subsequent placements
 * clockwise (or counter-clockwise).
 *
 * @method
 * @memberof Popper.Utils
 * @argument {String} placement - A valid placement (it accepts variations)
 * @argument {Boolean} counter - Set to true to walk the placements counterclockwise
 * @returns {Array} placements including their variations
 */
function clockwise(placement) {
  var counter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  var index = validPlacements.indexOf(placement);
  var arr = validPlacements.slice(index + 1).concat(validPlacements.slice(0, index));
  return counter ? arr.reverse() : arr;
}

var BEHAVIORS = {
  FLIP: 'flip',
  CLOCKWISE: 'clockwise',
  COUNTERCLOCKWISE: 'counterclockwise'
};

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function flip(data, options) {
  // if `inner` modifier is enabled, we can't use the `flip` modifier
  if (isModifierEnabled(data.instance.modifiers, 'inner')) {
    return data;
  }

  if (data.flipped && data.placement === data.originalPlacement) {
    // seems like flip is trying to loop, probably there's not enough space on any of the flippable sides
    return data;
  }

  var boundaries = getBoundaries(data.instance.popper, data.instance.reference, options.padding, options.boundariesElement);

  var placement = data.placement.split('-')[0];
  var placementOpposite = getOppositePlacement(placement);
  var variation = data.placement.split('-')[1] || '';

  var flipOrder = [];

  switch (options.behavior) {
    case BEHAVIORS.FLIP:
      flipOrder = [placement, placementOpposite];
      break;
    case BEHAVIORS.CLOCKWISE:
      flipOrder = clockwise(placement);
      break;
    case BEHAVIORS.COUNTERCLOCKWISE:
      flipOrder = clockwise(placement, true);
      break;
    default:
      flipOrder = options.behavior;
  }

  flipOrder.forEach(function (step, index) {
    if (placement !== step || flipOrder.length === index + 1) {
      return data;
    }

    placement = data.placement.split('-')[0];
    placementOpposite = getOppositePlacement(placement);

    var popperOffsets = data.offsets.popper;
    var refOffsets = data.offsets.reference;

    // using floor because the reference offsets may contain decimals we are not going to consider here
    var floor = Math.floor;
    var overlapsRef = placement === 'left' && floor(popperOffsets.right) > floor(refOffsets.left) || placement === 'right' && floor(popperOffsets.left) < floor(refOffsets.right) || placement === 'top' && floor(popperOffsets.bottom) > floor(refOffsets.top) || placement === 'bottom' && floor(popperOffsets.top) < floor(refOffsets.bottom);

    var overflowsLeft = floor(popperOffsets.left) < floor(boundaries.left);
    var overflowsRight = floor(popperOffsets.right) > floor(boundaries.right);
    var overflowsTop = floor(popperOffsets.top) < floor(boundaries.top);
    var overflowsBottom = floor(popperOffsets.bottom) > floor(boundaries.bottom);

    var overflowsBoundaries = placement === 'left' && overflowsLeft || placement === 'right' && overflowsRight || placement === 'top' && overflowsTop || placement === 'bottom' && overflowsBottom;

    // flip the variation if required
    var isVertical = ['top', 'bottom'].indexOf(placement) !== -1;
    var flippedVariation = !!options.flipVariations && (isVertical && variation === 'start' && overflowsLeft || isVertical && variation === 'end' && overflowsRight || !isVertical && variation === 'start' && overflowsTop || !isVertical && variation === 'end' && overflowsBottom);

    if (overlapsRef || overflowsBoundaries || flippedVariation) {
      // this boolean to detect any flip loop
      data.flipped = true;

      if (overlapsRef || overflowsBoundaries) {
        placement = flipOrder[index + 1];
      }

      if (flippedVariation) {
        variation = getOppositeVariation(variation);
      }

      data.placement = placement + (variation ? '-' + variation : '');

      // this object contains `position`, we want to preserve it along with
      // any additional property we may add in the future
      data.offsets.popper = _extends({}, data.offsets.popper, getPopperOffsets(data.instance.popper, data.offsets.reference, data.placement));

      data = runModifiers(data.instance.modifiers, data, 'flip');
    }
  });
  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function keepTogether(data) {
  var _data$offsets = data.offsets,
      popper = _data$offsets.popper,
      reference = _data$offsets.reference;

  var placement = data.placement.split('-')[0];
  var floor = Math.floor;
  var isVertical = ['top', 'bottom'].indexOf(placement) !== -1;
  var side = isVertical ? 'right' : 'bottom';
  var opSide = isVertical ? 'left' : 'top';
  var measurement = isVertical ? 'width' : 'height';

  if (popper[side] < floor(reference[opSide])) {
    data.offsets.popper[opSide] = floor(reference[opSide]) - popper[measurement];
  }
  if (popper[opSide] > floor(reference[side])) {
    data.offsets.popper[opSide] = floor(reference[side]);
  }

  return data;
}

/**
 * Converts a string containing value + unit into a px value number
 * @function
 * @memberof {modifiers~offset}
 * @private
 * @argument {String} str - Value + unit string
 * @argument {String} measurement - `height` or `width`
 * @argument {Object} popperOffsets
 * @argument {Object} referenceOffsets
 * @returns {Number|String}
 * Value in pixels, or original string if no values were extracted
 */
function toValue(str, measurement, popperOffsets, referenceOffsets) {
  // separate value from unit
  var split = str.match(/((?:\-|\+)?\d*\.?\d*)(.*)/);
  var value = +split[1];
  var unit = split[2];

  // If it's not a number it's an operator, I guess
  if (!value) {
    return str;
  }

  if (unit.indexOf('%') === 0) {
    var element = void 0;
    switch (unit) {
      case '%p':
        element = popperOffsets;
        break;
      case '%':
      case '%r':
      default:
        element = referenceOffsets;
    }

    var rect = getClientRect(element);
    return rect[measurement] / 100 * value;
  } else if (unit === 'vh' || unit === 'vw') {
    // if is a vh or vw, we calculate the size based on the viewport
    var size = void 0;
    if (unit === 'vh') {
      size = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    } else {
      size = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    }
    return size / 100 * value;
  } else {
    // if is an explicit pixel unit, we get rid of the unit and keep the value
    // if is an implicit unit, it's px, and we return just the value
    return value;
  }
}

/**
 * Parse an `offset` string to extrapolate `x` and `y` numeric offsets.
 * @function
 * @memberof {modifiers~offset}
 * @private
 * @argument {String} offset
 * @argument {Object} popperOffsets
 * @argument {Object} referenceOffsets
 * @argument {String} basePlacement
 * @returns {Array} a two cells array with x and y offsets in numbers
 */
function parseOffset(offset, popperOffsets, referenceOffsets, basePlacement) {
  var offsets = [0, 0];

  // Use height if placement is left or right and index is 0 otherwise use width
  // in this way the first offset will use an axis and the second one
  // will use the other one
  var useHeight = ['right', 'left'].indexOf(basePlacement) !== -1;

  // Split the offset string to obtain a list of values and operands
  // The regex addresses values with the plus or minus sign in front (+10, -20, etc)
  var fragments = offset.split(/(\+|\-)/).map(function (frag) {
    return frag.trim();
  });

  // Detect if the offset string contains a pair of values or a single one
  // they could be separated by comma or space
  var divider = fragments.indexOf(find(fragments, function (frag) {
    return frag.search(/,|\s/) !== -1;
  }));

  if (fragments[divider] && fragments[divider].indexOf(',') === -1) {
    console.warn('Offsets separated by white space(s) are deprecated, use a comma (,) instead.');
  }

  // If divider is found, we divide the list of values and operands to divide
  // them by ofset X and Y.
  var splitRegex = /\s*,\s*|\s+/;
  var ops = divider !== -1 ? [fragments.slice(0, divider).concat([fragments[divider].split(splitRegex)[0]]), [fragments[divider].split(splitRegex)[1]].concat(fragments.slice(divider + 1))] : [fragments];

  // Convert the values with units to absolute pixels to allow our computations
  ops = ops.map(function (op, index) {
    // Most of the units rely on the orientation of the popper
    var measurement = (index === 1 ? !useHeight : useHeight) ? 'height' : 'width';
    var mergeWithPrevious = false;
    return op
    // This aggregates any `+` or `-` sign that aren't considered operators
    // e.g.: 10 + +5 => [10, +, +5]
    .reduce(function (a, b) {
      if (a[a.length - 1] === '' && ['+', '-'].indexOf(b) !== -1) {
        a[a.length - 1] = b;
        mergeWithPrevious = true;
        return a;
      } else if (mergeWithPrevious) {
        a[a.length - 1] += b;
        mergeWithPrevious = false;
        return a;
      } else {
        return a.concat(b);
      }
    }, [])
    // Here we convert the string values into number values (in px)
    .map(function (str) {
      return toValue(str, measurement, popperOffsets, referenceOffsets);
    });
  });

  // Loop trough the offsets arrays and execute the operations
  ops.forEach(function (op, index) {
    op.forEach(function (frag, index2) {
      if (isNumeric(frag)) {
        offsets[index] += frag * (op[index2 - 1] === '-' ? -1 : 1);
      }
    });
  });
  return offsets;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @argument {Number|String} options.offset=0
 * The offset value as described in the modifier description
 * @returns {Object} The data object, properly modified
 */
function offset(data, _ref) {
  var offset = _ref.offset;
  var placement = data.placement,
      _data$offsets = data.offsets,
      popper = _data$offsets.popper,
      reference = _data$offsets.reference;

  var basePlacement = placement.split('-')[0];

  var offsets = void 0;
  if (isNumeric(+offset)) {
    offsets = [+offset, 0];
  } else {
    offsets = parseOffset(offset, popper, reference, basePlacement);
  }

  if (basePlacement === 'left') {
    popper.top += offsets[0];
    popper.left -= offsets[1];
  } else if (basePlacement === 'right') {
    popper.top += offsets[0];
    popper.left += offsets[1];
  } else if (basePlacement === 'top') {
    popper.left += offsets[0];
    popper.top -= offsets[1];
  } else if (basePlacement === 'bottom') {
    popper.left += offsets[0];
    popper.top += offsets[1];
  }

  data.popper = popper;
  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function preventOverflow(data, options) {
  var boundariesElement = options.boundariesElement || getOffsetParent(data.instance.popper);

  // If offsetParent is the reference element, we really want to
  // go one step up and use the next offsetParent as reference to
  // avoid to make this modifier completely useless and look like broken
  if (data.instance.reference === boundariesElement) {
    boundariesElement = getOffsetParent(boundariesElement);
  }

  var boundaries = getBoundaries(data.instance.popper, data.instance.reference, options.padding, boundariesElement);
  options.boundaries = boundaries;

  var order = options.priority;
  var popper = data.offsets.popper;

  var check = {
    primary: function primary(placement) {
      var value = popper[placement];
      if (popper[placement] < boundaries[placement] && !options.escapeWithReference) {
        value = Math.max(popper[placement], boundaries[placement]);
      }
      return defineProperty({}, placement, value);
    },
    secondary: function secondary(placement) {
      var mainSide = placement === 'right' ? 'left' : 'top';
      var value = popper[mainSide];
      if (popper[placement] > boundaries[placement] && !options.escapeWithReference) {
        value = Math.min(popper[mainSide], boundaries[placement] - (placement === 'right' ? popper.width : popper.height));
      }
      return defineProperty({}, mainSide, value);
    }
  };

  order.forEach(function (placement) {
    var side = ['left', 'top'].indexOf(placement) !== -1 ? 'primary' : 'secondary';
    popper = _extends({}, popper, check[side](placement));
  });

  data.offsets.popper = popper;

  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function shift(data) {
  var placement = data.placement;
  var basePlacement = placement.split('-')[0];
  var shiftvariation = placement.split('-')[1];

  // if shift shiftvariation is specified, run the modifier
  if (shiftvariation) {
    var _data$offsets = data.offsets,
        reference = _data$offsets.reference,
        popper = _data$offsets.popper;

    var isVertical = ['bottom', 'top'].indexOf(basePlacement) !== -1;
    var side = isVertical ? 'left' : 'top';
    var measurement = isVertical ? 'width' : 'height';

    var shiftOffsets = {
      start: defineProperty({}, side, reference[side]),
      end: defineProperty({}, side, reference[side] + reference[measurement] - popper[measurement])
    };

    data.offsets.popper = _extends({}, popper, shiftOffsets[shiftvariation]);
  }

  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by update method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function hide(data) {
  if (!isModifierRequired(data.instance.modifiers, 'hide', 'preventOverflow')) {
    return data;
  }

  var refRect = data.offsets.reference;
  var bound = find(data.instance.modifiers, function (modifier) {
    return modifier.name === 'preventOverflow';
  }).boundaries;

  if (refRect.bottom < bound.top || refRect.left > bound.right || refRect.top > bound.bottom || refRect.right < bound.left) {
    // Avoid unnecessary DOM access if visibility hasn't changed
    if (data.hide === true) {
      return data;
    }

    data.hide = true;
    data.attributes['x-out-of-boundaries'] = '';
  } else {
    // Avoid unnecessary DOM access if visibility hasn't changed
    if (data.hide === false) {
      return data;
    }

    data.hide = false;
    data.attributes['x-out-of-boundaries'] = false;
  }

  return data;
}

/**
 * @function
 * @memberof Modifiers
 * @argument {Object} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {Object} The data object, properly modified
 */
function inner(data) {
  var placement = data.placement;
  var basePlacement = placement.split('-')[0];
  var _data$offsets = data.offsets,
      popper = _data$offsets.popper,
      reference = _data$offsets.reference;

  var isHoriz = ['left', 'right'].indexOf(basePlacement) !== -1;

  var subtractLength = ['top', 'left'].indexOf(basePlacement) === -1;

  popper[isHoriz ? 'left' : 'top'] = reference[basePlacement] - (subtractLength ? popper[isHoriz ? 'width' : 'height'] : 0);

  data.placement = getOppositePlacement(placement);
  data.offsets.popper = getClientRect(popper);

  return data;
}

/**
 * Modifier function, each modifier can have a function of this type assigned
 * to its `fn` property.<br />
 * These functions will be called on each update, this means that you must
 * make sure they are performant enough to avoid performance bottlenecks.
 *
 * @function ModifierFn
 * @argument {dataObject} data - The data object generated by `update` method
 * @argument {Object} options - Modifiers configuration and options
 * @returns {dataObject} The data object, properly modified
 */

/**
 * Modifiers are plugins used to alter the behavior of your poppers.<br />
 * Popper.js uses a set of 9 modifiers to provide all the basic functionalities
 * needed by the library.
 *
 * Usually you don't want to override the `order`, `fn` and `onLoad` props.
 * All the other properties are configurations that could be tweaked.
 * @namespace modifiers
 */
var modifiers = {
  /**
   * Modifier used to shift the popper on the start or end of its reference
   * element.<br />
   * It will read the variation of the `placement` property.<br />
   * It can be one either `-end` or `-start`.
   * @memberof modifiers
   * @inner
   */
  shift: {
    /** @prop {number} order=100 - Index used to define the order of execution */
    order: 100,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: shift
  },

  /**
   * The `offset` modifier can shift your popper on both its axis.
   *
   * It accepts the following units:
   * - `px` or unitless, interpreted as pixels
   * - `%` or `%r`, percentage relative to the length of the reference element
   * - `%p`, percentage relative to the length of the popper element
   * - `vw`, CSS viewport width unit
   * - `vh`, CSS viewport height unit
   *
   * For length is intended the main axis relative to the placement of the popper.<br />
   * This means that if the placement is `top` or `bottom`, the length will be the
   * `width`. In case of `left` or `right`, it will be the height.
   *
   * You can provide a single value (as `Number` or `String`), or a pair of values
   * as `String` divided by a comma or one (or more) white spaces.<br />
   * The latter is a deprecated method because it leads to confusion and will be
   * removed in v2.<br />
   * Additionally, it accepts additions and subtractions between different units.
   * Note that multiplications and divisions aren't supported.
   *
   * Valid examples are:
   * ```
   * 10
   * '10%'
   * '10, 10'
   * '10%, 10'
   * '10 + 10%'
   * '10 - 5vh + 3%'
   * '-10px + 5vh, 5px - 6%'
   * ```
   * > **NB**: If you desire to apply offsets to your poppers in a way that may make them overlap
   * > with their reference element, unfortunately, you will have to disable the `flip` modifier.
   * > More on this [reading this issue](https://github.com/FezVrasta/popper.js/issues/373)
   *
   * @memberof modifiers
   * @inner
   */
  offset: {
    /** @prop {number} order=200 - Index used to define the order of execution */
    order: 200,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: offset,
    /** @prop {Number|String} offset=0
     * The offset value as described in the modifier description
     */
    offset: 0
  },

  /**
   * Modifier used to prevent the popper from being positioned outside the boundary.
   *
   * An scenario exists where the reference itself is not within the boundaries.<br />
   * We can say it has "escaped the boundaries" — or just "escaped".<br />
   * In this case we need to decide whether the popper should either:
   *
   * - detach from the reference and remain "trapped" in the boundaries, or
   * - if it should ignore the boundary and "escape with its reference"
   *
   * When `escapeWithReference` is set to`true` and reference is completely
   * outside its boundaries, the popper will overflow (or completely leave)
   * the boundaries in order to remain attached to the edge of the reference.
   *
   * @memberof modifiers
   * @inner
   */
  preventOverflow: {
    /** @prop {number} order=300 - Index used to define the order of execution */
    order: 300,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: preventOverflow,
    /**
     * @prop {Array} [priority=['left','right','top','bottom']]
     * Popper will try to prevent overflow following these priorities by default,
     * then, it could overflow on the left and on top of the `boundariesElement`
     */
    priority: ['left', 'right', 'top', 'bottom'],
    /**
     * @prop {number} padding=5
     * Amount of pixel used to define a minimum distance between the boundaries
     * and the popper this makes sure the popper has always a little padding
     * between the edges of its container
     */
    padding: 5,
    /**
     * @prop {String|HTMLElement} boundariesElement='scrollParent'
     * Boundaries used by the modifier, can be `scrollParent`, `window`,
     * `viewport` or any DOM element.
     */
    boundariesElement: 'scrollParent'
  },

  /**
   * Modifier used to make sure the reference and its popper stay near eachothers
   * without leaving any gap between the two. Expecially useful when the arrow is
   * enabled and you want to assure it to point to its reference element.
   * It cares only about the first axis, you can still have poppers with margin
   * between the popper and its reference element.
   * @memberof modifiers
   * @inner
   */
  keepTogether: {
    /** @prop {number} order=400 - Index used to define the order of execution */
    order: 400,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: keepTogether
  },

  /**
   * This modifier is used to move the `arrowElement` of the popper to make
   * sure it is positioned between the reference element and its popper element.
   * It will read the outer size of the `arrowElement` node to detect how many
   * pixels of conjuction are needed.
   *
   * It has no effect if no `arrowElement` is provided.
   * @memberof modifiers
   * @inner
   */
  arrow: {
    /** @prop {number} order=500 - Index used to define the order of execution */
    order: 500,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: arrow,
    /** @prop {String|HTMLElement} element='[x-arrow]' - Selector or node used as arrow */
    element: '[x-arrow]'
  },

  /**
   * Modifier used to flip the popper's placement when it starts to overlap its
   * reference element.
   *
   * Requires the `preventOverflow` modifier before it in order to work.
   *
   * **NOTE:** this modifier will interrupt the current update cycle and will
   * restart it if it detects the need to flip the placement.
   * @memberof modifiers
   * @inner
   */
  flip: {
    /** @prop {number} order=600 - Index used to define the order of execution */
    order: 600,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: flip,
    /**
     * @prop {String|Array} behavior='flip'
     * The behavior used to change the popper's placement. It can be one of
     * `flip`, `clockwise`, `counterclockwise` or an array with a list of valid
     * placements (with optional variations).
     */
    behavior: 'flip',
    /**
     * @prop {number} padding=5
     * The popper will flip if it hits the edges of the `boundariesElement`
     */
    padding: 5,
    /**
     * @prop {String|HTMLElement} boundariesElement='viewport'
     * The element which will define the boundaries of the popper position,
     * the popper will never be placed outside of the defined boundaries
     * (except if keepTogether is enabled)
     */
    boundariesElement: 'viewport'
  },

  /**
   * Modifier used to make the popper flow toward the inner of the reference element.
   * By default, when this modifier is disabled, the popper will be placed outside
   * the reference element.
   * @memberof modifiers
   * @inner
   */
  inner: {
    /** @prop {number} order=700 - Index used to define the order of execution */
    order: 700,
    /** @prop {Boolean} enabled=false - Whether the modifier is enabled or not */
    enabled: false,
    /** @prop {ModifierFn} */
    fn: inner
  },

  /**
   * Modifier used to hide the popper when its reference element is outside of the
   * popper boundaries. It will set a `x-out-of-boundaries` attribute which can
   * be used to hide with a CSS selector the popper when its reference is
   * out of boundaries.
   *
   * Requires the `preventOverflow` modifier before it in order to work.
   * @memberof modifiers
   * @inner
   */
  hide: {
    /** @prop {number} order=800 - Index used to define the order of execution */
    order: 800,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: hide
  },

  /**
   * Computes the style that will be applied to the popper element to gets
   * properly positioned.
   *
   * Note that this modifier will not touch the DOM, it just prepares the styles
   * so that `applyStyle` modifier can apply it. This separation is useful
   * in case you need to replace `applyStyle` with a custom implementation.
   *
   * This modifier has `850` as `order` value to maintain backward compatibility
   * with previous versions of Popper.js. Expect the modifiers ordering method
   * to change in future major versions of the library.
   *
   * @memberof modifiers
   * @inner
   */
  computeStyle: {
    /** @prop {number} order=850 - Index used to define the order of execution */
    order: 850,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: computeStyle,
    /**
     * @prop {Boolean} gpuAcceleration=true
     * If true, it uses the CSS 3d transformation to position the popper.
     * Otherwise, it will use the `top` and `left` properties.
     */
    gpuAcceleration: true,
    /**
     * @prop {string} [x='bottom']
     * Where to anchor the X axis (`bottom` or `top`). AKA X offset origin.
     * Change this if your popper should grow in a direction different from `bottom`
     */
    x: 'bottom',
    /**
     * @prop {string} [x='left']
     * Where to anchor the Y axis (`left` or `right`). AKA Y offset origin.
     * Change this if your popper should grow in a direction different from `right`
     */
    y: 'right'
  },

  /**
   * Applies the computed styles to the popper element.
   *
   * All the DOM manipulations are limited to this modifier. This is useful in case
   * you want to integrate Popper.js inside a framework or view library and you
   * want to delegate all the DOM manipulations to it.
   *
   * Note that if you disable this modifier, you must make sure the popper element
   * has its position set to `absolute` before Popper.js can do its work!
   *
   * Just disable this modifier and define you own to achieve the desired effect.
   *
   * @memberof modifiers
   * @inner
   */
  applyStyle: {
    /** @prop {number} order=900 - Index used to define the order of execution */
    order: 900,
    /** @prop {Boolean} enabled=true - Whether the modifier is enabled or not */
    enabled: true,
    /** @prop {ModifierFn} */
    fn: applyStyle,
    /** @prop {Function} */
    onLoad: applyStyleOnLoad,
    /**
     * @deprecated since version 1.10.0, the property moved to `computeStyle` modifier
     * @prop {Boolean} gpuAcceleration=true
     * If true, it uses the CSS 3d transformation to position the popper.
     * Otherwise, it will use the `top` and `left` properties.
     */
    gpuAcceleration: undefined
  }
};

/**
 * The `dataObject` is an object containing all the informations used by Popper.js
 * this object get passed to modifiers and to the `onCreate` and `onUpdate` callbacks.
 * @name dataObject
 * @property {Object} data.instance The Popper.js instance
 * @property {String} data.placement Placement applied to popper
 * @property {String} data.originalPlacement Placement originally defined on init
 * @property {Boolean} data.flipped True if popper has been flipped by flip modifier
 * @property {Boolean} data.hide True if the reference element is out of boundaries, useful to know when to hide the popper.
 * @property {HTMLElement} data.arrowElement Node used as arrow by arrow modifier
 * @property {Object} data.styles Any CSS property defined here will be applied to the popper, it expects the JavaScript nomenclature (eg. `marginBottom`)
 * @property {Object} data.arrowStyles Any CSS property defined here will be applied to the popper arrow, it expects the JavaScript nomenclature (eg. `marginBottom`)
 * @property {Object} data.boundaries Offsets of the popper boundaries
 * @property {Object} data.offsets The measurements of popper, reference and arrow elements.
 * @property {Object} data.offsets.popper `top`, `left`, `width`, `height` values
 * @property {Object} data.offsets.reference `top`, `left`, `width`, `height` values
 * @property {Object} data.offsets.arrow] `top` and `left` offsets, only one of them will be different from 0
 */

/**
 * Default options provided to Popper.js constructor.<br />
 * These can be overriden using the `options` argument of Popper.js.<br />
 * To override an option, simply pass as 3rd argument an object with the same
 * structure of this object, example:
 * ```
 * new Popper(ref, pop, {
 *   modifiers: {
 *     preventOverflow: { enabled: false }
 *   }
 * })
 * ```
 * @type {Object}
 * @static
 * @memberof Popper
 */
var Defaults = {
  /**
   * Popper's placement
   * @prop {Popper.placements} placement='bottom'
   */
  placement: 'bottom',

  /**
   * Whether events (resize, scroll) are initially enabled
   * @prop {Boolean} eventsEnabled=true
   */
  eventsEnabled: true,

  /**
   * Set to true if you want to automatically remove the popper when
   * you call the `destroy` method.
   * @prop {Boolean} removeOnDestroy=false
   */
  removeOnDestroy: false,

  /**
   * Callback called when the popper is created.<br />
   * By default, is set to no-op.<br />
   * Access Popper.js instance with `data.instance`.
   * @prop {onCreate}
   */
  onCreate: function onCreate() {},

  /**
   * Callback called when the popper is updated, this callback is not called
   * on the initialization/creation of the popper, but only on subsequent
   * updates.<br />
   * By default, is set to no-op.<br />
   * Access Popper.js instance with `data.instance`.
   * @prop {onUpdate}
   */
  onUpdate: function onUpdate() {},

  /**
   * List of modifiers used to modify the offsets before they are applied to the popper.
   * They provide most of the functionalities of Popper.js
   * @prop {modifiers}
   */
  modifiers: modifiers
};

/**
 * @callback onCreate
 * @param {dataObject} data
 */

/**
 * @callback onUpdate
 * @param {dataObject} data
 */

// Utils
// Methods
var Popper = function () {
  /**
   * Create a new Popper.js instance
   * @class Popper
   * @param {HTMLElement|referenceObject} reference - The reference element used to position the popper
   * @param {HTMLElement} popper - The HTML element used as popper.
   * @param {Object} options - Your custom options to override the ones defined in [Defaults](#defaults)
   * @return {Object} instance - The generated Popper.js instance
   */
  function Popper(reference, popper) {
    var _this = this;

    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    classCallCheck(this, Popper);

    this.scheduleUpdate = function () {
      return requestAnimationFrame(_this.update);
    };

    // make update() debounced, so that it only runs at most once-per-tick
    this.update = debounce(this.update.bind(this));

    // with {} we create a new object with the options inside it
    this.options = _extends({}, Popper.Defaults, options);

    // init state
    this.state = {
      isDestroyed: false,
      isCreated: false,
      scrollParents: []
    };

    // get reference and popper elements (allow jQuery wrappers)
    this.reference = reference && reference.jquery ? reference[0] : reference;
    this.popper = popper && popper.jquery ? popper[0] : popper;

    // Deep merge modifiers options
    this.options.modifiers = {};
    Object.keys(_extends({}, Popper.Defaults.modifiers, options.modifiers)).forEach(function (name) {
      _this.options.modifiers[name] = _extends({}, Popper.Defaults.modifiers[name] || {}, options.modifiers ? options.modifiers[name] : {});
    });

    // Refactoring modifiers' list (Object => Array)
    this.modifiers = Object.keys(this.options.modifiers).map(function (name) {
      return _extends({
        name: name
      }, _this.options.modifiers[name]);
    })
    // sort the modifiers by order
    .sort(function (a, b) {
      return a.order - b.order;
    });

    // modifiers have the ability to execute arbitrary code when Popper.js get inited
    // such code is executed in the same order of its modifier
    // they could add new properties to their options configuration
    // BE AWARE: don't add options to `options.modifiers.name` but to `modifierOptions`!
    this.modifiers.forEach(function (modifierOptions) {
      if (modifierOptions.enabled && isFunction(modifierOptions.onLoad)) {
        modifierOptions.onLoad(_this.reference, _this.popper, _this.options, modifierOptions, _this.state);
      }
    });

    // fire the first update to position the popper in the right place
    this.update();

    var eventsEnabled = this.options.eventsEnabled;
    if (eventsEnabled) {
      // setup event listeners, they will take care of update the position in specific situations
      this.enableEventListeners();
    }

    this.state.eventsEnabled = eventsEnabled;
  }

  // We can't use class properties because they don't get listed in the
  // class prototype and break stuff like Sinon stubs


  createClass(Popper, [{
    key: 'update',
    value: function update$$1() {
      return update.call(this);
    }
  }, {
    key: 'destroy',
    value: function destroy$$1() {
      return destroy.call(this);
    }
  }, {
    key: 'enableEventListeners',
    value: function enableEventListeners$$1() {
      return enableEventListeners.call(this);
    }
  }, {
    key: 'disableEventListeners',
    value: function disableEventListeners$$1() {
      return disableEventListeners.call(this);
    }

    /**
     * Schedule an update, it will run on the next UI update available
     * @method scheduleUpdate
     * @memberof Popper
     */


    /**
     * Collection of utilities useful when writing custom modifiers.
     * Starting from version 1.7, this method is available only if you
     * include `popper-utils.js` before `popper.js`.
     *
     * **DEPRECATION**: This way to access PopperUtils is deprecated
     * and will be removed in v2! Use the PopperUtils module directly instead.
     * Due to the high instability of the methods contained in Utils, we can't
     * guarantee them to follow semver. Use them at your own risk!
     * @static
     * @private
     * @type {Object}
     * @deprecated since version 1.8
     * @member Utils
     * @memberof Popper
     */

  }]);
  return Popper;
}();

/**
 * The `referenceObject` is an object that provides an interface compatible with Popper.js
 * and lets you use it as replacement of a real DOM node.<br />
 * You can use this method to position a popper relatively to a set of coordinates
 * in case you don't have a DOM node to use as reference.
 *
 * ```
 * new Popper(referenceObject, popperNode);
 * ```
 *
 * NB: This feature isn't supported in Internet Explorer 10
 * @name referenceObject
 * @property {Function} data.getBoundingClientRect
 * A function that returns a set of coordinates compatible with the native `getBoundingClientRect` method.
 * @property {number} data.clientWidth
 * An ES6 getter that will return the width of the virtual reference element.
 * @property {number} data.clientHeight
 * An ES6 getter that will return the height of the virtual reference element.
 */


Popper.Utils = (typeof window !== 'undefined' ? window : global).PopperUtils;
Popper.placements = placements;
Popper.Defaults = Defaults;

return Popper;

})));
//# sourceMappingURL=popper.js.map

;/**!
 * @fileOverview Kickass library to create and place poppers near their reference elements.
 * @version 1.1.7
 * @license
 * Copyright (c) 2016 Federico Zivolo and contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('popper.js')) :
	typeof define === 'function' && define.amd ? define(['popper.js'], factory) :
	(global.Tooltip = factory(global.Popper));
}(this, (function (Popper) { 'use strict';

Popper = Popper && 'default' in Popper ? Popper['default'] : Popper;

/**
 * Check if the given variable is a function
 * @method
 * @memberof Popper.Utils
 * @argument {Any} functionToCheck - variable to check
 * @returns {Boolean} answer to: is a function?
 */
function isFunction(functionToCheck) {
  var getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var DEFAULT_OPTIONS = {
  container: false,
  delay: 0,
  html: false,
  placement: 'top',
  title: '',
  template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
  trigger: 'hover focus',
  offset: 0
};

var Tooltip = function () {
  /**
   * Create a new Tooltip.js instance
   * @class Tooltip
   * @param {HTMLElement} reference - The DOM node used as reference of the tooltip (it can be a jQuery element).
   * @param {Object} options
   * @param {String} options.placement=bottom
   *      Placement of the popper accepted values: `top(-start, -end), right(-start, -end), bottom(-start, -end),
   *      left(-start, -end)`
   * @param {HTMLElement|String|false} options.container=false - Append the tooltip to a specific element.
   * @param {Number|Object} options.delay=0
   *      Delay showing and hiding the tooltip (ms) - does not apply to manual trigger type.
   *      If a number is supplied, delay is applied to both hide/show.
   *      Object structure is: `{ show: 500, hide: 100 }`
   * @param {Boolean} options.html=false - Insert HTML into the tooltip. If false, the content will inserted with `innerText`.
   * @param {String|PlacementFunction} options.placement='top' - One of the allowed placements, or a function returning one of them.
   * @param {String} [options.template='<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>']
   *      Base HTML to used when creating the tooltip.
   *      The tooltip's `title` will be injected into the `.tooltip-inner` or `.tooltip__inner`.
   *      `.tooltip-arrow` or `.tooltip__arrow` will become the tooltip's arrow.
   *      The outermost wrapper element should have the `.tooltip` class.
   * @param {String|HTMLElement|TitleFunction} options.title='' - Default title value if `title` attribute isn't present.
   * @param {String} [options.trigger='hover focus']
   *      How tooltip is triggered - click, hover, focus, manual.
   *      You may pass multiple triggers; separate them with a space. `manual` cannot be combined with any other trigger.
   * @param {HTMLElement} options.boundariesElement
   *      The element used as boundaries for the tooltip. For more information refer to Popper.js'
   *      [boundariesElement docs](https://popper.js.org/popper-documentation.html)
   * @param {Number|String} options.offset=0 - Offset of the tooltip relative to its reference. For more information refer to Popper.js'
   *      [offset docs](https://popper.js.org/popper-documentation.html)
   * @param {Object} options.popperOptions={} - Popper options, will be passed directly to popper instance. For more information refer to Popper.js'
   *      [options docs](https://popper.js.org/popper-documentation.html)
   * @return {Object} instance - The generated tooltip instance
   */
  function Tooltip(reference, options) {
    classCallCheck(this, Tooltip);

    _initialiseProps.call(this);

    // apply user options over default ones
    options = _extends({}, DEFAULT_OPTIONS, options);

    reference.jquery && (reference = reference[0]);

    // cache reference and options
    this.reference = reference;
    this.options = options;

    // get events list
    var events = typeof options.trigger === 'string' ? options.trigger.split(' ').filter(function (trigger) {
      return ['click', 'hover', 'focus'].indexOf(trigger) !== -1;
    }) : [];

    // set initial state
    this._isOpen = false;
    this._popperOptions = {};

    // set event listeners
    this._setEventListeners(reference, events, options);
  }

  //
  // Public methods
  //

  /**
   * Reveals an element's tooltip. This is considered a "manual" triggering of the tooltip.
   * Tooltips with zero-length titles are never displayed.
   * @method Tooltip#show
   * @memberof Tooltip
   */


  /**
   * Hides an element’s tooltip. This is considered a “manual” triggering of the tooltip.
   * @method Tooltip#hide
   * @memberof Tooltip
   */


  /**
   * Hides and destroys an element’s tooltip.
   * @method Tooltip#dispose
   * @memberof Tooltip
   */


  /**
   * Toggles an element’s tooltip. This is considered a “manual” triggering of the tooltip.
   * @method Tooltip#toggle
   * @memberof Tooltip
   */


  //
  // Defaults
  //


  //
  // Private methods
  //

  createClass(Tooltip, [{
    key: '_create',


    /**
     * Creates a new tooltip node
     * @memberof Tooltip
     * @private
     * @param {HTMLElement} reference
     * @param {String} template
     * @param {String|HTMLElement|TitleFunction} title
     * @param {Boolean} allowHtml
     * @return {HTMLelement} tooltipNode
     */
    value: function _create(reference, template, title, allowHtml) {
      // create tooltip element
      var tooltipGenerator = window.document.createElement('div');
      tooltipGenerator.innerHTML = template.trim();
      var tooltipNode = tooltipGenerator.childNodes[0];

      // add unique ID to our tooltip (needed for accessibility reasons)
      tooltipNode.id = 'tooltip_' + Math.random().toString(36).substr(2, 10);

      // set initial `aria-hidden` state to `false` (it's visible!)
      tooltipNode.setAttribute('aria-hidden', 'false');

      // add title to tooltip
      var titleNode = tooltipGenerator.querySelector(this.innerSelector);
      if (title.nodeType === 1 || title.nodeType === 11) {
        // if title is a element node or document fragment, append it only if allowHtml is true
        allowHtml && titleNode.appendChild(title);
      } else if (isFunction(title)) {
        // if title is a function, call it and set innerText or innerHtml depending by `allowHtml` value
        var titleText = title.call(reference);
        allowHtml ? titleNode.innerHTML = titleText : titleNode.innerText = titleText;
      } else {
        // if it's just a simple text, set innerText or innerHtml depending by `allowHtml` value
        allowHtml ? titleNode.innerHTML = title : titleNode.innerText = title;
      }

      // return the generated tooltip node
      return tooltipNode;
    }
  }, {
    key: '_show',
    value: function _show(reference, options) {
      // don't show if it's already visible
      // or if it's not being showed
      if (this._isOpen && !this._isOpening) {
        return this;
      }
      this._isOpen = true;

      // if the tooltipNode already exists, just show it
      if (this._tooltipNode) {
        this._tooltipNode.style.display = '';
        this._tooltipNode.setAttribute('aria-hidden', 'false');
        this.popperInstance.update();
        return this;
      }

      // get title
      var title = reference.getAttribute('title') || options.title;

      // don't show tooltip if no title is defined
      if (!title) {
        return this;
      }

      // create tooltip node
      var tooltipNode = this._create(reference, options.template, title, options.html);

      // Add `aria-describedby` to our reference element for accessibility reasons
      reference.setAttribute('aria-describedby', tooltipNode.id);

      // append tooltip to container
      var container = this._findContainer(options.container, reference);

      this._append(tooltipNode, container);

      this._popperOptions = _extends({}, options.popperOptions, {
        placement: options.placement
      });

      this._popperOptions.modifiers = _extends({}, this._popperOptions.modifiers, {
        arrow: {
          element: this.arrowSelector
        },
        offset: {
          offset: options.offset
        }
      });

      if (options.boundariesElement) {
        this._popperOptions.modifiers.preventOverflow = {
          boundariesElement: options.boundariesElement
        };
      }

      this.popperInstance = new Popper(reference, tooltipNode, this._popperOptions);

      this._tooltipNode = tooltipNode;

      return this;
    }
  }, {
    key: '_hide',
    value: function _hide() /*reference, options*/{
      // don't hide if it's already hidden
      if (!this._isOpen) {
        return this;
      }

      this._isOpen = false;

      // hide tooltipNode
      this._tooltipNode.style.display = 'none';
      this._tooltipNode.setAttribute('aria-hidden', 'true');

      return this;
    }
  }, {
    key: '_dispose',
    value: function _dispose() {
      var _this = this;

      // remove event listeners first to prevent any unexpected behaviour
      this._events.forEach(function (_ref) {
        var func = _ref.func,
            event = _ref.event;

        _this.reference.removeEventListener(event, func);
      });
      this._events = [];

      if (this._tooltipNode) {
        this._hide();

        // destroy instance
        this.popperInstance.destroy();

        // destroy tooltipNode if removeOnDestroy is not set, as popperInstance.destroy() already removes the element
        if (!this.popperInstance.options.removeOnDestroy) {
          this._tooltipNode.parentNode.removeChild(this._tooltipNode);
          this._tooltipNode = null;
        }
      }
      return this;
    }
  }, {
    key: '_findContainer',
    value: function _findContainer(container, reference) {
      // if container is a query, get the relative element
      if (typeof container === 'string') {
        container = window.document.querySelector(container);
      } else if (container === false) {
        // if container is `false`, set it to reference parent
        container = reference.parentNode;
      }
      return container;
    }

    /**
     * Append tooltip to container
     * @memberof Tooltip
     * @private
     * @param {HTMLElement} tooltip
     * @param {HTMLElement|String|false} container
     */

  }, {
    key: '_append',
    value: function _append(tooltipNode, container) {
      container.appendChild(tooltipNode);
    }
  }, {
    key: '_setEventListeners',
    value: function _setEventListeners(reference, events, options) {
      var _this2 = this;

      var directEvents = [];
      var oppositeEvents = [];

      events.forEach(function (event) {
        switch (event) {
          case 'hover':
            directEvents.push('mouseenter');
            oppositeEvents.push('mouseleave');
            break;
          case 'focus':
            directEvents.push('focus');
            oppositeEvents.push('blur');
            break;
          case 'click':
            directEvents.push('click');
            oppositeEvents.push('click');
            break;
        }
      });

      // schedule show tooltip
      directEvents.forEach(function (event) {
        var func = function func(evt) {
          if (_this2._isOpening === true) {
            return;
          }
          evt.usedByTooltip = true;
          _this2._scheduleShow(reference, options.delay, options, evt);
        };
        _this2._events.push({ event: event, func: func });
        reference.addEventListener(event, func);
      });

      // schedule hide tooltip
      oppositeEvents.forEach(function (event) {
        var func = function func(evt) {
          if (evt.usedByTooltip === true) {
            return;
          }
          _this2._scheduleHide(reference, options.delay, options, evt);
        };
        _this2._events.push({ event: event, func: func });
        reference.addEventListener(event, func);
      });
    }
  }, {
    key: '_scheduleShow',
    value: function _scheduleShow(reference, delay, options /*, evt */) {
      var _this3 = this;

      this._isOpening = true;
      // defaults to 0
      var computedDelay = delay && delay.show || delay || 0;
      this._showTimeout = window.setTimeout(function () {
        return _this3._show(reference, options);
      }, computedDelay);
    }
  }, {
    key: '_scheduleHide',
    value: function _scheduleHide(reference, delay, options, evt) {
      var _this4 = this;

      this._isOpening = false;
      // defaults to 0
      var computedDelay = delay && delay.hide || delay || 0;
      window.setTimeout(function () {
        window.clearTimeout(_this4._showTimeout);
        if (_this4._isOpen === false) {
          return;
        }
        if (!document.body.contains(_this4._tooltipNode)) {
          return;
        }

        // if we are hiding because of a mouseleave, we must check that the new
        // reference isn't the tooltip, because in this case we don't want to hide it
        if (evt.type === 'mouseleave') {
          var isSet = _this4._setTooltipNodeEvent(evt, reference, delay, options);

          // if we set the new event, don't hide the tooltip yet
          // the new event will take care to hide it if necessary
          if (isSet) {
            return;
          }
        }

        _this4._hide(reference, options);
      }, computedDelay);
    }
  }]);
  return Tooltip;
}();

/**
 * Placement function, its context is the Tooltip instance.
 * @memberof Tooltip
 * @callback PlacementFunction
 * @param {HTMLElement} tooltip - tooltip DOM node.
 * @param {HTMLElement} reference - reference DOM node.
 * @return {String} placement - One of the allowed placement options.
 */

/**
 * Title function, its context is the Tooltip instance.
 * @memberof Tooltip
 * @callback TitleFunction
 * @return {String} placement - The desired title.
 */


var _initialiseProps = function _initialiseProps() {
  var _this5 = this;

  this.show = function () {
    return _this5._show(_this5.reference, _this5.options);
  };

  this.hide = function () {
    return _this5._hide();
  };

  this.dispose = function () {
    return _this5._dispose();
  };

  this.toggle = function () {
    if (_this5._isOpen) {
      return _this5.hide();
    } else {
      return _this5.show();
    }
  };

  this.arrowSelector = '.tooltip-arrow, .tooltip__arrow';
  this.innerSelector = '.tooltip-inner, .tooltip__inner';
  this._events = [];

  this._setTooltipNodeEvent = function (evt, reference, delay, options) {
    var relatedreference = evt.relatedreference || evt.toElement || evt.relatedTarget;

    var callback = function callback(evt2) {
      var relatedreference2 = evt2.relatedreference || evt2.toElement || evt2.relatedTarget;

      // Remove event listener after call
      _this5._tooltipNode.removeEventListener(evt.type, callback);

      // If the new reference is not the reference element
      if (!reference.contains(relatedreference2)) {
        // Schedule to hide tooltip
        _this5._scheduleHide(reference, options.delay, options, evt2);
      }
    };

    if (_this5._tooltipNode.contains(relatedreference)) {
      // listen to mouseleave on the tooltip element to be able to hide the tooltip
      _this5._tooltipNode.addEventListener(evt.type, callback);
      return true;
    }

    return false;
  };
};

return Tooltip;

})));
//# sourceMappingURL=tooltip.js.map

;// ==================================================
// fancyBox v3.3.5
//
// Licensed GPLv3 for open source use
// or fancyBox Commercial License for commercial use
//
// http://fancyapps.com/fancybox/
// Copyright 2018 fancyApps
//
// ==================================================
(function(window, document, $, undefined) {
  "use strict";

  window.console = window.console || {
    info: function(stuff) {}
  };

  // If there's no jQuery, fancyBox can't work
  // =========================================

  if (!$) {
    return;
  }

  // Check if fancyBox is already initialized
  // ========================================

  if ($.fn.fancybox) {
    console.info("fancyBox already initialized");

    return;
  }

  // Private default settings
  // ========================

  var defaults = {
    // Enable infinite gallery navigation
    loop: false,

    // Horizontal space between slides
    gutter: 50,

    // Enable keyboard navigation
    keyboard: true,

    // Should display navigation arrows at the screen edges
    arrows: true,

    // Should display counter at the top left corner
    infobar: true,

    // Should display close button (using `btnTpl.smallBtn` template) over the content
    // Can be true, false, "auto"
    // If "auto" - will be automatically enabled for "html", "inline" or "ajax" items
    smallBtn: "auto",

    // Should display toolbar (buttons at the top)
    // Can be true, false, "auto"
    // If "auto" - will be automatically hidden if "smallBtn" is enabled
    toolbar: "auto",

    // What buttons should appear in the top right corner.
    // Buttons will be created using templates from `btnTpl` option
    // and they will be placed into toolbar (class="fancybox-toolbar"` element)
    buttons: [
      "zoom",
      //"share",
      //"slideShow",
      //"fullScreen",
      //"download",
      "thumbs",
      "close"
    ],

    // Detect "idle" time in seconds
    idleTime: 3,

    // Disable right-click and use simple image protection for images
    protect: false,

    // Shortcut to make content "modal" - disable keyboard navigtion, hide buttons, etc
    modal: false,

    image: {
      // Wait for images to load before displaying
      //   true  - wait for image to load and then display;
      //   false - display thumbnail and load the full-sized image over top,
      //           requires predefined image dimensions (`data-width` and `data-height` attributes)
      preload: false
    },

    ajax: {
      // Object containing settings for ajax request
      settings: {
        // This helps to indicate that request comes from the modal
        // Feel free to change naming
        data: {
          fancybox: true
        }
      }
    },

    iframe: {
      // Iframe template
      tpl:
        '<iframe id="fancybox-frame{rnd}" name="fancybox-frame{rnd}" class="fancybox-iframe" frameborder="0" vspace="0" hspace="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen allowtransparency="true" src=""></iframe>',

      // Preload iframe before displaying it
      // This allows to calculate iframe content width and height
      // (note: Due to "Same Origin Policy", you can't get cross domain data).
      preload: true,

      // Custom CSS styling for iframe wrapping element
      // You can use this to set custom iframe dimensions
      css: {},

      // Iframe tag attributes
      attr: {
        scrolling: "auto"
      }
    },

    // Default content type if cannot be detected automatically
    defaultType: "image",

    // Open/close animation type
    // Possible values:
    //   false            - disable
    //   "zoom"           - zoom images from/to thumbnail
    //   "fade"
    //   "zoom-in-out"
    //
    animationEffect: "zoom",

    // Duration in ms for open/close animation
    animationDuration: 366,

    // Should image change opacity while zooming
    // If opacity is "auto", then opacity will be changed if image and thumbnail have different aspect ratios
    zoomOpacity: "auto",

    // Transition effect between slides
    //
    // Possible values:
    //   false            - disable
    //   "fade'
    //   "slide'
    //   "circular'
    //   "tube'
    //   "zoom-in-out'
    //   "rotate'
    //
    transitionEffect: "fade",

    // Duration in ms for transition animation
    transitionDuration: 366,

    // Custom CSS class for slide element
    slideClass: "",

    // Custom CSS class for layout
    baseClass: "",

    // Base template for layout
    baseTpl:
      '<div class="fancybox-container" role="dialog" tabindex="-1">' +
      '<div class="fancybox-bg"></div>' +
      '<div class="fancybox-inner">' +
      '<div class="fancybox-infobar">' +
      "<span data-fancybox-index></span>&nbsp;/&nbsp;<span data-fancybox-count></span>" +
      "</div>" +
      '<div class="fancybox-toolbar">{{buttons}}</div>' +
      '<div class="fancybox-navigation">{{arrows}}</div>' +
      '<div class="fancybox-stage"></div>' +
      '<div class="fancybox-caption"></div>' +
      "</div>" +
      "</div>",

    // Loading indicator template
    spinnerTpl: '<div class="fancybox-loading"></div>',

    // Error message template
    errorTpl: '<div class="fancybox-error"><p>{{ERROR}}</p></div>',

    btnTpl: {
      download:
        '<a download data-fancybox-download class="fancybox-button fancybox-button--download" title="{{DOWNLOAD}}" href="javascript:;">' +
        '<svg viewBox="0 0 40 40">' +
        '<path d="M13,16 L20,23 L27,16 M20,7 L20,23 M10,24 L10,28 L30,28 L30,24" />' +
        "</svg>" +
        "</a>",

      zoom:
        '<button data-fancybox-zoom class="fancybox-button fancybox-button--zoom" title="{{ZOOM}}">' +
        '<svg viewBox="0 0 40 40">' +
        '<path d="M18,17 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 M24,22 L31,29" />' +
        "</svg>" +
        "</button>",

      close:
        '<button data-fancybox-close class="fancybox-button fancybox-button--close" title="{{CLOSE}}">' +
        '<svg viewBox="0 0 40 40">' +
        '<path d="M10,10 L30,30 M30,10 L10,30" />' +
        "</svg>" +
        "</button>",

      // This small close button will be appended to your html/inline/ajax content by default,
      // if "smallBtn" option is not set to false
      smallBtn:
        '<button data-fancybox-close class="fancybox-close-small" title="{{CLOSE}}"><svg viewBox="0 0 32 32"><path d="M10,10 L22,22 M22,10 L10,22"></path></svg></button>',

      // Arrows
      arrowLeft:
        '<a data-fancybox-prev class="fancybox-button fancybox-button--arrow_left" title="{{PREV}}" href="javascript:;">' +
        '<svg viewBox="0 0 40 40">' +
        '<path d="M18,12 L10,20 L18,28 M10,20 L30,20"></path>' +
        "</svg>" +
        "</a>",

      arrowRight:
        '<a data-fancybox-next class="fancybox-button fancybox-button--arrow_right" title="{{NEXT}}" href="javascript:;">' +
        '<svg viewBox="0 0 40 40">' +
        '<path d="M10,20 L30,20 M22,12 L30,20 L22,28"></path>' +
        "</svg>" +
        "</a>"
    },

    // Container is injected into this element
    parentEl: "body",

    // Focus handling
    // ==============

    // Try to focus on the first focusable element after opening
    autoFocus: false,

    // Put focus back to active element after closing
    backFocus: true,

    // Do not let user to focus on element outside modal content
    trapFocus: true,

    // Module specific options
    // =======================

    fullScreen: {
      autoStart: false
    },

    // Set `touch: false` to disable dragging/swiping
    touch: {
      vertical: true, // Allow to drag content vertically
      momentum: true // Continue movement after releasing mouse/touch when panning
    },

    // Hash value when initializing manually,
    // set `false` to disable hash change
    hash: null,

    // Customize or add new media types
    // Example:
    /*
        media : {
            youtube : {
                params : {
                    autoplay : 0
                }
            }
        }
        */
    media: {},

    slideShow: {
      autoStart: false,
      speed: 4000
    },

    thumbs: {
      autoStart: false, // Display thumbnails on opening
      hideOnClose: true, // Hide thumbnail grid when closing animation starts
      parentEl: ".fancybox-container", // Container is injected into this element
      axis: "y" // Vertical (y) or horizontal (x) scrolling
    },

    // Use mousewheel to navigate gallery
    // If 'auto' - enabled for images only
    wheel: "auto",

    // Callbacks
    //==========

    // See Documentation/API/Events for more information
    // Example:
    /*
		afterShow: function( instance, current ) {
			console.info( 'Clicked element:' );
			console.info( current.opts.$orig );
		}
	*/

    onInit: $.noop, // When instance has been initialized

    beforeLoad: $.noop, // Before the content of a slide is being loaded
    afterLoad: $.noop, // When the content of a slide is done loading

    beforeShow: $.noop, // Before open animation starts
    afterShow: $.noop, // When content is done loading and animating

    beforeClose: $.noop, // Before the instance attempts to close. Return false to cancel the close.
    afterClose: $.noop, // After instance has been closed

    onActivate: $.noop, // When instance is brought to front
    onDeactivate: $.noop, // When other instance has been activated

    // Interaction
    // ===========

    // Use options below to customize taken action when user clicks or double clicks on the fancyBox area,
    // each option can be string or method that returns value.
    //
    // Possible values:
    //   "close"           - close instance
    //   "next"            - move to next gallery item
    //   "nextOrClose"     - move to next gallery item or close if gallery has only one item
    //   "toggleControls"  - show/hide controls
    //   "zoom"            - zoom image (if loaded)
    //   false             - do nothing

    // Clicked on the content
    clickContent: function(current, event) {
      return current.type === "image" ? "zoom" : false;
    },

    // Clicked on the slide
    clickSlide: "close",

    // Clicked on the background (backdrop) element;
    // if you have not changed the layout, then most likely you need to use `clickSlide` option
    clickOutside: "close",

    // Same as previous two, but for double click
    dblclickContent: false,
    dblclickSlide: false,
    dblclickOutside: false,

    // Custom options when mobile device is detected
    // =============================================

    mobile: {
      idleTime: false,
      clickContent: function(current, event) {
        return current.type === "image" ? "toggleControls" : false;
      },
      clickSlide: function(current, event) {
        return current.type === "image" ? "toggleControls" : "close";
      },
      dblclickContent: function(current, event) {
        return current.type === "image" ? "zoom" : false;
      },
      dblclickSlide: function(current, event) {
        return current.type === "image" ? "zoom" : false;
      }
    },

    // Internationalization
    // ====================

    lang: "en",
    i18n: {
      en: {
        CLOSE: "Close",
        NEXT: "Next",
        PREV: "Previous",
        ERROR: "The requested content cannot be loaded. <br/> Please try again later.",
        PLAY_START: "Start slideshow",
        PLAY_STOP: "Pause slideshow",
        FULL_SCREEN: "Full screen",
        THUMBS: "Thumbnails",
        DOWNLOAD: "Download",
        SHARE: "Share",
        ZOOM: "Zoom"
      },
      de: {
        CLOSE: "Schliessen",
        NEXT: "Weiter",
        PREV: "Zurück",
        ERROR: "Die angeforderten Daten konnten nicht geladen werden. <br/> Bitte versuchen Sie es später nochmal.",
        PLAY_START: "Diaschau starten",
        PLAY_STOP: "Diaschau beenden",
        FULL_SCREEN: "Vollbild",
        THUMBS: "Vorschaubilder",
        DOWNLOAD: "Herunterladen",
        SHARE: "Teilen",
        ZOOM: "Maßstab"
      }
    }
  };

  // Few useful variables and methods
  // ================================

  var $W = $(window);
  var $D = $(document);

  var called = 0;

  // Check if an object is a jQuery object and not a native JavaScript object
  // ========================================================================
  var isQuery = function(obj) {
    return obj && obj.hasOwnProperty && obj instanceof $;
  };

  // Handle multiple browsers for "requestAnimationFrame" and "cancelAnimationFrame"
  // ===============================================================================
  var requestAFrame = (function() {
    return (
      window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      // if all else fails, use setTimeout
      function(callback) {
        return window.setTimeout(callback, 1000 / 60);
      }
    );
  })();

  // Detect the supported transition-end event property name
  // =======================================================
  var transitionEnd = (function() {
    var el = document.createElement("fakeelement"),
      t;

    var transitions = {
      transition: "transitionend",
      OTransition: "oTransitionEnd",
      MozTransition: "transitionend",
      WebkitTransition: "webkitTransitionEnd"
    };

    for (t in transitions) {
      if (el.style[t] !== undefined) {
        return transitions[t];
      }
    }

    return "transitionend";
  })();

  // Force redraw on an element.
  // This helps in cases where the browser doesn't redraw an updated element properly
  // ================================================================================
  var forceRedraw = function($el) {
    return $el && $el.length && $el[0].offsetHeight;
  };

  // Exclude array (`buttons`) options from deep merging
  // ===================================================
  var mergeOpts = function(opts1, opts2) {
    var rez = $.extend(true, {}, opts1, opts2);

    $.each(opts2, function(key, value) {
      if ($.isArray(value)) {
        rez[key] = value;
      }
    });

    return rez;
  };

  // Class definition
  // ================

  var FancyBox = function(content, opts, index) {
    var self = this;

    self.opts = mergeOpts({index: index}, $.fancybox.defaults);

    if ($.isPlainObject(opts)) {
      self.opts = mergeOpts(self.opts, opts);
    }

    if ($.fancybox.isMobile) {
      self.opts = mergeOpts(self.opts, self.opts.mobile);
    }

    self.id = self.opts.id || ++called;

    self.currIndex = parseInt(self.opts.index, 10) || 0;
    self.prevIndex = null;

    self.prevPos = null;
    self.currPos = 0;

    self.firstRun = true;

    // All group items
    self.group = [];

    // Existing slides (for current, next and previous gallery items)
    self.slides = {};

    // Create group elements
    self.addContent(content);

    if (!self.group.length) {
      return;
    }

    // Save last active element
    self.$lastFocus = $(document.activeElement).trigger("blur");

    self.init();
  };

  $.extend(FancyBox.prototype, {
    // Create DOM structure
    // ====================

    init: function() {
      var self = this,
        firstItem = self.group[self.currIndex],
        firstItemOpts = firstItem.opts,
        scrollbarWidth = $.fancybox.scrollbarWidth,
        $scrollDiv,
        $container,
        buttonStr;

      // Hide scrollbars
      // ===============

      if (!$.fancybox.getInstance() && firstItemOpts.hideScrollbar !== false) {
        $("body").addClass("fancybox-active");

        if (!$.fancybox.isMobile && document.body.scrollHeight > window.innerHeight) {
          if (scrollbarWidth === undefined) {
            $scrollDiv = $('<div style="width:100px;height:100px;overflow:scroll;" />').appendTo("body");

            scrollbarWidth = $.fancybox.scrollbarWidth = $scrollDiv[0].offsetWidth - $scrollDiv[0].clientWidth;

            $scrollDiv.remove();
          }

          $("head").append(
            '<style id="fancybox-style-noscroll" type="text/css">.compensate-for-scrollbar { margin-right: ' +
              scrollbarWidth +
              "px; }</style>"
          );

          $("body").addClass("compensate-for-scrollbar");
        }
      }

      // Build html markup and set references
      // ====================================

      // Build html code for buttons and insert into main template
      buttonStr = "";

      $.each(firstItemOpts.buttons, function(index, value) {
        buttonStr += firstItemOpts.btnTpl[value] || "";
      });

      // Create markup from base template, it will be initially hidden to
      // avoid unnecessary work like painting while initializing is not complete
      $container = $(
        self.translate(
          self,
          firstItemOpts.baseTpl
            .replace("{{buttons}}", buttonStr)
            .replace("{{arrows}}", firstItemOpts.btnTpl.arrowLeft + firstItemOpts.btnTpl.arrowRight)
        )
      )
        .attr("id", "fancybox-container-" + self.id)
        .addClass("fancybox-is-hidden")
        .addClass(firstItemOpts.baseClass)
        .data("FancyBox", self)
        .appendTo(firstItemOpts.parentEl);

      // Create object holding references to jQuery wrapped nodes
      self.$refs = {
        container: $container
      };

      ["bg", "inner", "infobar", "toolbar", "stage", "caption", "navigation"].forEach(function(item) {
        self.$refs[item] = $container.find(".fancybox-" + item);
      });

      self.trigger("onInit");

      // Enable events, deactive previous instances
      self.activate();

      // Build slides, load and reveal content
      self.jumpTo(self.currIndex);
    },

    // Simple i18n support - replaces object keys found in template
    // with corresponding values
    // ============================================================

    translate: function(obj, str) {
      var arr = obj.opts.i18n[obj.opts.lang];

      return str.replace(/\{\{(\w+)\}\}/g, function(match, n) {
        var value = arr[n];

        if (value === undefined) {
          return match;
        }

        return value;
      });
    },

    // Populate current group with fresh content
    // Check if each object has valid type and content
    // ===============================================

    addContent: function(content) {
      var self = this,
        items = $.makeArray(content),
        thumbs;

      $.each(items, function(i, item) {
        var obj = {},
          opts = {},
          $item,
          type,
          found,
          src,
          srcParts;

        // Step 1 - Make sure we have an object
        // ====================================

        if ($.isPlainObject(item)) {
          // We probably have manual usage here, something like
          // $.fancybox.open( [ { src : "image.jpg", type : "image" } ] )

          obj = item;
          opts = item.opts || item;
        } else if ($.type(item) === "object" && $(item).length) {
          // Here we probably have jQuery collection returned by some selector
          $item = $(item);

          // Support attributes like `data-options='{"touch" : false}'` and `data-touch='false'`
          opts = $item.data() || {};
          opts = $.extend(true, {}, opts, opts.options);

          // Here we store clicked element
          opts.$orig = $item;

          obj.src = self.opts.src || opts.src || $item.attr("href");

          // Assume that simple syntax is used, for example:
          //   `$.fancybox.open( $("#test"), {} );`
          if (!obj.type && !obj.src) {
            obj.type = "inline";
            obj.src = item;
          }
        } else {
          // Assume we have a simple html code, for example:
          //   $.fancybox.open( '<div><h1>Hi!</h1></div>' );
          obj = {
            type: "html",
            src: item + ""
          };
        }

        // Each gallery object has full collection of options
        obj.opts = $.extend(true, {}, self.opts, opts);

        // Do not merge buttons array
        if ($.isArray(opts.buttons)) {
          obj.opts.buttons = opts.buttons;
        }

        // Step 2 - Make sure we have content type, if not - try to guess
        // ==============================================================

        type = obj.type || obj.opts.type;
        src = obj.src || "";

        if (!type && src) {
          if ((found = src.match(/\.(mp4|mov|ogv)((\?|#).*)?$/i))) {
            type = "video";

            if (!obj.opts.videoFormat) {
              obj.opts.videoFormat = "video/" + (found[1] === "ogv" ? "ogg" : found[1]);
            }
          } else if (src.match(/(^data:image\/[a-z0-9+\/=]*,)|(\.(jp(e|g|eg)|gif|png|bmp|webp|svg|ico)((\?|#).*)?$)/i)) {
            type = "image";
          } else if (src.match(/\.(pdf)((\?|#).*)?$/i)) {
            type = "iframe";
          } else if (src.charAt(0) === "#") {
            type = "inline";
          }
        }

        if (type) {
          obj.type = type;
        } else {
          self.trigger("objectNeedsType", obj);
        }

        if (!obj.contentType) {
          obj.contentType = $.inArray(obj.type, ["html", "inline", "ajax"]) > -1 ? "html" : obj.type;
        }

        // Step 3 - Some adjustments
        // =========================

        obj.index = self.group.length;

        if (obj.opts.smallBtn == "auto") {
          obj.opts.smallBtn = $.inArray(obj.type, ["html", "inline", "ajax"]) > -1;
        }

        if (obj.opts.toolbar === "auto") {
          obj.opts.toolbar = !obj.opts.smallBtn;
        }

        // Find thumbnail image
        if (obj.opts.$trigger && obj.index === self.opts.index) {
          obj.opts.$thumb = obj.opts.$trigger.find("img:first");
        }

        if ((!obj.opts.$thumb || !obj.opts.$thumb.length) && obj.opts.$orig) {
          obj.opts.$thumb = obj.opts.$orig.find("img:first");
        }

        // "caption" is a "special" option, it can be used to customize caption per gallery item ..
        if ($.type(obj.opts.caption) === "function") {
          obj.opts.caption = obj.opts.caption.apply(item, [self, obj]);
        }

        if ($.type(self.opts.caption) === "function") {
          obj.opts.caption = self.opts.caption.apply(item, [self, obj]);
        }

        // Make sure we have caption as a string or jQuery object
        if (!(obj.opts.caption instanceof $)) {
          obj.opts.caption = obj.opts.caption === undefined ? "" : obj.opts.caption + "";
        }

        // Check if url contains "filter" used to filter the content
        // Example: "ajax.html #something"
        if (obj.type === "ajax") {
          srcParts = src.split(/\s+/, 2);

          if (srcParts.length > 1) {
            obj.src = srcParts.shift();

            obj.opts.filter = srcParts.shift();
          }
        }

        // Hide all buttons and disable interactivity for modal items
        if (obj.opts.modal) {
          obj.opts = $.extend(true, obj.opts, {
            // Remove buttons
            infobar: 0,
            toolbar: 0,

            smallBtn: 0,

            // Disable keyboard navigation
            keyboard: 0,

            // Disable some modules
            slideShow: 0,
            fullScreen: 0,
            thumbs: 0,
            touch: 0,

            // Disable click event handlers
            clickContent: false,
            clickSlide: false,
            clickOutside: false,
            dblclickContent: false,
            dblclickSlide: false,
            dblclickOutside: false
          });
        }

        // Step 4 - Add processed object to group
        // ======================================

        self.group.push(obj);
      });

      // Update controls if gallery is already opened
      if (Object.keys(self.slides).length) {
        self.updateControls();

        // Update thumbnails, if needed
        thumbs = self.Thumbs;

        if (thumbs && thumbs.isActive) {
          thumbs.create();

          thumbs.focus();
        }
      }
    },

    // Attach an event handler functions for:
    //   - navigation buttons
    //   - browser scrolling, resizing;
    //   - focusing
    //   - keyboard
    //   - detect idle
    // ======================================

    addEvents: function() {
      var self = this;

      self.removeEvents();

      // Make navigation elements clickable
      self.$refs.container
        .on("click.fb-close", "[data-fancybox-close]", function(e) {
          e.stopPropagation();
          e.preventDefault();

          self.close(e);
        })
        .on("touchstart.fb-prev click.fb-prev", "[data-fancybox-prev]", function(e) {
          e.stopPropagation();
          e.preventDefault();

          self.previous();
        })
        .on("touchstart.fb-next click.fb-next", "[data-fancybox-next]", function(e) {
          e.stopPropagation();
          e.preventDefault();

          self.next();
        })
        .on("click.fb", "[data-fancybox-zoom]", function(e) {
          // Click handler for zoom button
          self[self.isScaledDown() ? "scaleToActual" : "scaleToFit"]();
        });

      // Handle page scrolling and browser resizing
      $W.on("orientationchange.fb resize.fb", function(e) {
        if (e && e.originalEvent && e.originalEvent.type === "resize") {
          requestAFrame(function() {
            self.update();
          });
        } else {
          self.$refs.stage.hide();

          setTimeout(function() {
            self.$refs.stage.show();

            self.update();
          }, $.fancybox.isMobile ? 600 : 250);
        }
      });

      // Trap keyboard focus inside of the modal, so the user does not accidentally tab outside of the modal
      // (a.k.a. "escaping the modal")
      $D.on("focusin.fb", function(e) {
        var instance = $.fancybox ? $.fancybox.getInstance() : null;

        if (
          instance.isClosing ||
          !instance.current ||
          !instance.current.opts.trapFocus ||
          $(e.target).hasClass("fancybox-container") ||
          $(e.target).is(document)
        ) {
          return;
        }

        if (instance && $(e.target).css("position") !== "fixed" && !instance.$refs.container.has(e.target).length) {
          e.stopPropagation();

          instance.focus();
        }
      });

      // Enable keyboard navigation
      $D.on("keydown.fb", function(e) {
        var current = self.current,
          keycode = e.keyCode || e.which;

        if (!current || !current.opts.keyboard) {
          return;
        }

        if (e.ctrlKey || e.altKey || e.shiftKey || $(e.target).is("input") || $(e.target).is("textarea")) {
          return;
        }

        // Backspace and Esc keys
        if (keycode === 8 || keycode === 27) {
          e.preventDefault();

          self.close(e);

          return;
        }

        // Left arrow and Up arrow
        if (keycode === 37 || keycode === 38) {
          e.preventDefault();

          self.previous();

          return;
        }

        // Righ arrow and Down arrow
        if (keycode === 39 || keycode === 40) {
          e.preventDefault();

          self.next();

          return;
        }

        self.trigger("afterKeydown", e, keycode);
      });

      // Hide controls after some inactivity period
      if (self.group[self.currIndex].opts.idleTime) {
        self.idleSecondsCounter = 0;

        $D.on(
          "mousemove.fb-idle mouseleave.fb-idle mousedown.fb-idle touchstart.fb-idle touchmove.fb-idle scroll.fb-idle keydown.fb-idle",
          function(e) {
            self.idleSecondsCounter = 0;

            if (self.isIdle) {
              self.showControls();
            }

            self.isIdle = false;
          }
        );

        self.idleInterval = window.setInterval(function() {
          self.idleSecondsCounter++;

          if (self.idleSecondsCounter >= self.group[self.currIndex].opts.idleTime && !self.isDragging) {
            self.isIdle = true;
            self.idleSecondsCounter = 0;

            self.hideControls();
          }
        }, 1000);
      }
    },

    // Remove events added by the core
    // ===============================

    removeEvents: function() {
      var self = this;

      $W.off("orientationchange.fb resize.fb");
      $D.off("focusin.fb keydown.fb .fb-idle");

      this.$refs.container.off(".fb-close .fb-prev .fb-next");

      if (self.idleInterval) {
        window.clearInterval(self.idleInterval);

        self.idleInterval = null;
      }
    },

    // Change to previous gallery item
    // ===============================

    previous: function(duration) {
      return this.jumpTo(this.currPos - 1, duration);
    },

    // Change to next gallery item
    // ===========================

    next: function(duration) {
      return this.jumpTo(this.currPos + 1, duration);
    },

    // Switch to selected gallery item
    // ===============================

    jumpTo: function(pos, duration) {
      var self = this,
        groupLen = self.group.length,
        firstRun,
        loop,
        current,
        previous,
        canvasWidth,
        currentPos,
        transitionProps;

      if (self.isDragging || self.isClosing || (self.isAnimating && self.firstRun)) {
        return;
      }

      pos = parseInt(pos, 10);

      // Should loop?
      loop = self.current ? self.current.opts.loop : self.opts.loop;

      if (!loop && (pos < 0 || pos >= groupLen)) {
        return false;
      }

      firstRun = self.firstRun = !Object.keys(self.slides).length;

      if (groupLen < 2 && !firstRun && !!self.isDragging) {
        return;
      }

      previous = self.current;

      self.prevIndex = self.currIndex;
      self.prevPos = self.currPos;

      // Create slides
      current = self.createSlide(pos);

      if (groupLen > 1) {
        if (loop || current.index > 0) {
          self.createSlide(pos - 1);
        }

        if (loop || current.index < groupLen - 1) {
          self.createSlide(pos + 1);
        }
      }

      self.current = current;
      self.currIndex = current.index;
      self.currPos = current.pos;

      self.trigger("beforeShow", firstRun);

      self.updateControls();

      currentPos = $.fancybox.getTranslate(current.$slide);

      current.isMoved = (currentPos.left !== 0 || currentPos.top !== 0) && !current.$slide.hasClass("fancybox-animated");

      // Validate duration length
      current.forcedDuration = undefined;

      if ($.isNumeric(duration)) {
        current.forcedDuration = duration;
      } else {
        duration = current.opts[firstRun ? "animationDuration" : "transitionDuration"];
      }

      duration = parseInt(duration, 10);

      // Fresh start - reveal container, current slide and start loading content
      if (firstRun) {
        if (current.opts.animationEffect && duration) {
          self.$refs.container.css("transition-duration", duration + "ms");
        }

        self.$refs.container.removeClass("fancybox-is-hidden");

        forceRedraw(self.$refs.container);

        self.$refs.container.addClass("fancybox-is-open");

        forceRedraw(self.$refs.container);

        // Make current slide visible
        current.$slide.addClass("fancybox-slide--previous");

        // Attempt to load content into slide;
        // at this point image would start loading, but inline/html content would load immediately
        self.loadSlide(current);

        current.$slide.removeClass("fancybox-slide--previous").addClass("fancybox-slide--current");

        self.preload("image");

        return;
      }

      // Clean up
      $.each(self.slides, function(index, slide) {
        $.fancybox.stop(slide.$slide);
      });

      // Make current that slide is visible even if content is still loading
      current.$slide.removeClass("fancybox-slide--next fancybox-slide--previous").addClass("fancybox-slide--current");

      // If slides have been dragged, animate them to correct position
      if (current.isMoved) {
        canvasWidth = Math.round(current.$slide.width());

        $.each(self.slides, function(index, slide) {
          var pos = slide.pos - current.pos;

          $.fancybox.animate(
            slide.$slide,
            {
              top: 0,
              left: pos * canvasWidth + pos * slide.opts.gutter
            },
            duration,
            function() {
              slide.$slide.removeAttr("style").removeClass("fancybox-slide--next fancybox-slide--previous");

              if (slide.pos === self.currPos) {
                current.isMoved = false;

                self.complete();
              }
            }
          );
        });
      } else {
        self.$refs.stage.children().removeAttr("style");
      }

      // Start transition that reveals current content
      // or wait when it will be loaded

      if (current.isLoaded) {
        self.revealContent(current);
      } else {
        self.loadSlide(current);
      }

      self.preload("image");

      if (previous.pos === current.pos) {
        return;
      }

      // Handle previous slide
      // =====================

      transitionProps = "fancybox-slide--" + (previous.pos > current.pos ? "next" : "previous");

      previous.$slide.removeClass("fancybox-slide--complete fancybox-slide--current fancybox-slide--next fancybox-slide--previous");

      previous.isComplete = false;

      if (!duration || (!current.isMoved && !current.opts.transitionEffect)) {
        return;
      }

      if (current.isMoved) {
        previous.$slide.addClass(transitionProps);
      } else {
        transitionProps = "fancybox-animated " + transitionProps + " fancybox-fx-" + current.opts.transitionEffect;

        $.fancybox.animate(previous.$slide, transitionProps, duration, function() {
          previous.$slide.removeClass(transitionProps).removeAttr("style");
        });
      }
    },

    // Create new "slide" element
    // These are gallery items  that are actually added to DOM
    // =======================================================

    createSlide: function(pos) {
      var self = this,
        $slide,
        index;

      index = pos % self.group.length;
      index = index < 0 ? self.group.length + index : index;

      if (!self.slides[pos] && self.group[index]) {
        $slide = $('<div class="fancybox-slide"></div>').appendTo(self.$refs.stage);

        self.slides[pos] = $.extend(true, {}, self.group[index], {
          pos: pos,
          $slide: $slide,
          isLoaded: false
        });

        self.updateSlide(self.slides[pos]);
      }

      return self.slides[pos];
    },

    // Scale image to the actual size of the image;
    // x and y values should be relative to the slide
    // ==============================================

    scaleToActual: function(x, y, duration) {
      var self = this,
        current = self.current,
        $content = current.$content,
        canvasWidth = $.fancybox.getTranslate(current.$slide).width,
        canvasHeight = $.fancybox.getTranslate(current.$slide).height,
        newImgWidth = current.width,
        newImgHeight = current.height,
        imgPos,
        posX,
        posY,
        scaleX,
        scaleY;

      if (self.isAnimating || !$content || !(current.type == "image" && current.isLoaded && !current.hasError)) {
        return;
      }

      $.fancybox.stop($content);

      self.isAnimating = true;

      x = x === undefined ? canvasWidth * 0.5 : x;
      y = y === undefined ? canvasHeight * 0.5 : y;

      imgPos = $.fancybox.getTranslate($content);

      imgPos.top -= $.fancybox.getTranslate(current.$slide).top;
      imgPos.left -= $.fancybox.getTranslate(current.$slide).left;

      scaleX = newImgWidth / imgPos.width;
      scaleY = newImgHeight / imgPos.height;

      // Get center position for original image
      posX = canvasWidth * 0.5 - newImgWidth * 0.5;
      posY = canvasHeight * 0.5 - newImgHeight * 0.5;

      // Make sure image does not move away from edges
      if (newImgWidth > canvasWidth) {
        posX = imgPos.left * scaleX - (x * scaleX - x);

        if (posX > 0) {
          posX = 0;
        }

        if (posX < canvasWidth - newImgWidth) {
          posX = canvasWidth - newImgWidth;
        }
      }

      if (newImgHeight > canvasHeight) {
        posY = imgPos.top * scaleY - (y * scaleY - y);

        if (posY > 0) {
          posY = 0;
        }

        if (posY < canvasHeight - newImgHeight) {
          posY = canvasHeight - newImgHeight;
        }
      }

      self.updateCursor(newImgWidth, newImgHeight);

      $.fancybox.animate(
        $content,
        {
          top: posY,
          left: posX,
          scaleX: scaleX,
          scaleY: scaleY
        },
        duration || 330,
        function() {
          self.isAnimating = false;
        }
      );

      // Stop slideshow
      if (self.SlideShow && self.SlideShow.isActive) {
        self.SlideShow.stop();
      }
    },

    // Scale image to fit inside parent element
    // ========================================

    scaleToFit: function(duration) {
      var self = this,
        current = self.current,
        $content = current.$content,
        end;

      if (self.isAnimating || !$content || !(current.type == "image" && current.isLoaded && !current.hasError)) {
        return;
      }

      $.fancybox.stop($content);

      self.isAnimating = true;

      end = self.getFitPos(current);

      self.updateCursor(end.width, end.height);

      $.fancybox.animate(
        $content,
        {
          top: end.top,
          left: end.left,
          scaleX: end.width / $content.width(),
          scaleY: end.height / $content.height()
        },
        duration || 330,
        function() {
          self.isAnimating = false;
        }
      );
    },

    // Calculate image size to fit inside viewport
    // ===========================================

    getFitPos: function(slide) {
      var self = this,
        $content = slide.$content,
        width = slide.width || slide.opts.width,
        height = slide.height || slide.opts.height,
        maxWidth,
        maxHeight,
        minRatio,
        margin,
        aspectRatio,
        rez = {};

      if (!slide.isLoaded || !$content || !$content.length) {
        return false;
      }

      margin = {
        top: parseInt(slide.$slide.css("paddingTop"), 10),
        right: parseInt(slide.$slide.css("paddingRight"), 10),
        bottom: parseInt(slide.$slide.css("paddingBottom"), 10),
        left: parseInt(slide.$slide.css("paddingLeft"), 10)
      };

      // We can not use $slide width here, because it can have different diemensions while in transiton
      maxWidth = parseInt(self.$refs.stage.width(), 10) - (margin.left + margin.right);
      maxHeight = parseInt(self.$refs.stage.height(), 10) - (margin.top + margin.bottom);

      if (!width || !height) {
        width = maxWidth;
        height = maxHeight;
      }

      minRatio = Math.min(1, maxWidth / width, maxHeight / height);

      // Use floor rounding to make sure it really fits
      width = Math.floor(minRatio * width);
      height = Math.floor(minRatio * height);

      if (slide.type === "image") {
        rez.top = Math.floor((maxHeight - height) * 0.5) + margin.top;
        rez.left = Math.floor((maxWidth - width) * 0.5) + margin.left;
      } else if (slide.contentType === "video") {
        // Force aspect ratio for the video
        // "I say the whole world must learn of our peaceful ways… by force!"
        aspectRatio = slide.opts.width && slide.opts.height ? width / height : slide.opts.ratio || 16 / 9;

        if (height > width / aspectRatio) {
          height = width / aspectRatio;
        } else if (width > height * aspectRatio) {
          width = height * aspectRatio;
        }
      }

      rez.width = width;
      rez.height = height;

      return rez;
    },

    // Update content size and position for all slides
    // ==============================================

    update: function() {
      var self = this;

      $.each(self.slides, function(key, slide) {
        self.updateSlide(slide);
      });
    },

    // Update slide content position and size
    // ======================================

    updateSlide: function(slide, duration) {
      var self = this,
        $content = slide && slide.$content,
        width = slide.width || slide.opts.width,
        height = slide.height || slide.opts.height;

      if ($content && (width || height || slide.contentType === "video") && !slide.hasError) {
        $.fancybox.stop($content);

        $.fancybox.setTranslate($content, self.getFitPos(slide));

        if (slide.pos === self.currPos) {
          self.isAnimating = false;

          self.updateCursor();
        }
      }

      slide.$slide.trigger("refresh");

      self.$refs.toolbar.toggleClass("compensate-for-scrollbar", slide.$slide.get(0).scrollHeight > slide.$slide.get(0).clientHeight);

      self.trigger("onUpdate", slide);
    },

    // Horizontally center slide
    // =========================

    centerSlide: function(slide, duration) {
      var self = this,
        canvasWidth,
        pos;

      if (self.current) {
        canvasWidth = Math.round(slide.$slide.width());
        pos = slide.pos - self.current.pos;

        $.fancybox.animate(
          slide.$slide,
          {
            top: 0,
            left: pos * canvasWidth + pos * slide.opts.gutter,
            opacity: 1
          },
          duration === undefined ? 0 : duration,
          null,
          false
        );
      }
    },

    // Update cursor style depending if content can be zoomed
    // ======================================================

    updateCursor: function(nextWidth, nextHeight) {
      var self = this,
        current = self.current,
        $container = self.$refs.container.removeClass("fancybox-is-zoomable fancybox-can-zoomIn fancybox-can-drag fancybox-can-zoomOut"),
        isZoomable;

      if (!current || self.isClosing) {
        return;
      }

      isZoomable = self.isZoomable();

      $container.toggleClass("fancybox-is-zoomable", isZoomable);

      $("[data-fancybox-zoom]").prop("disabled", !isZoomable);

      // Set cursor to zoom in/out if click event is 'zoom'
      if (
        isZoomable &&
        (current.opts.clickContent === "zoom" || ($.isFunction(current.opts.clickContent) && current.opts.clickContent(current) === "zoom"))
      ) {
        if (self.isScaledDown(nextWidth, nextHeight)) {
          // If image is scaled down, then, obviously, it can be zoomed to full size
          $container.addClass("fancybox-can-zoomIn");
        } else {
          if (current.opts.touch) {
            // If image size ir largen than available available and touch module is not disable,
            // then user can do panning
            $container.addClass("fancybox-can-drag");
          } else {
            $container.addClass("fancybox-can-zoomOut");
          }
        }
      } else if (current.opts.touch && current.contentType !== "video") {
        $container.addClass("fancybox-can-drag");
      }
    },

    // Check if current slide is zoomable
    // ==================================

    isZoomable: function() {
      var self = this,
        current = self.current,
        fitPos;

      // Assume that slide is zoomable if:
      //   - image is still loading
      //   - actual size of the image is smaller than available area
      if (current && !self.isClosing && current.type === "image" && !current.hasError) {
        if (!current.isLoaded) {
          return true;
        }

        fitPos = self.getFitPos(current);

        if (current.width > fitPos.width || current.height > fitPos.height) {
          return true;
        }
      }

      return false;
    },

    // Check if current image dimensions are smaller than actual
    // =========================================================

    isScaledDown: function(nextWidth, nextHeight) {
      var self = this,
        rez = false,
        current = self.current,
        $content = current.$content;

      if (nextWidth !== undefined && nextHeight !== undefined) {
        rez = nextWidth < current.width && nextHeight < current.height;
      } else if ($content) {
        rez = $.fancybox.getTranslate($content);
        rez = rez.width < current.width && rez.height < current.height;
      }

      return rez;
    },

    // Check if image dimensions exceed parent element
    // ===============================================

    canPan: function() {
      var self = this,
        rez = false,
        current = self.current,
        $content;

      if (current.type === "image" && ($content = current.$content) && !current.hasError) {
        rez = self.getFitPos(current);
        rez = Math.abs($content.width() - rez.width) > 1 || Math.abs($content.height() - rez.height) > 1;
      }

      return rez;
    },

    // Load content into the slide
    // ===========================

    loadSlide: function(slide) {
      var self = this,
        type,
        $slide,
        ajaxLoad;

      if (slide.isLoading || slide.isLoaded) {
        return;
      }

      slide.isLoading = true;

      self.trigger("beforeLoad", slide);

      type = slide.type;
      $slide = slide.$slide;

      $slide
        .off("refresh")
        .trigger("onReset")
        .addClass(slide.opts.slideClass);

      // Create content depending on the type
      switch (type) {
        case "image":
          self.setImage(slide);

          break;

        case "iframe":
          self.setIframe(slide);

          break;

        case "html":
          self.setContent(slide, slide.src || slide.content);

          break;

        case "video":
          self.setContent(
            slide,
            '<video class="fancybox-video" controls controlsList="nodownload">' +
              '<source src="' +
              slide.src +
              '" type="' +
              slide.opts.videoFormat +
              '">' +
              "Your browser doesn't support HTML5 video" +
              "</video"
          );

          break;

        case "inline":
          if ($(slide.src).length) {
            self.setContent(slide, $(slide.src));
          } else {
            self.setError(slide);
          }

          break;

        case "ajax":
          self.showLoading(slide);

          ajaxLoad = $.ajax(
            $.extend({}, slide.opts.ajax.settings, {
              url: slide.src,
              success: function(data, textStatus) {
                if (textStatus === "success") {
                  self.setContent(slide, data);
                }
              },
              error: function(jqXHR, textStatus) {
                if (jqXHR && textStatus !== "abort") {
                  self.setError(slide);
                }
              }
            })
          );

          $slide.one("onReset", function() {
            ajaxLoad.abort();
          });

          break;

        default:
          self.setError(slide);

          break;
      }

      return true;
    },

    // Use thumbnail image, if possible
    // ================================

    setImage: function(slide) {
      var self = this,
        srcset = slide.opts.srcset || slide.opts.image.srcset,
        thumbSrc,
        found,
        temp,
        pxRatio,
        windowWidth;

      // Check if need to show loading icon
      slide.timouts = setTimeout(function() {
        var $img = slide.$image;

        if (slide.isLoading && (!$img || !$img[0].complete) && !slide.hasError) {
          self.showLoading(slide);
        }
      }, 350);

      // If we have "srcset", then we need to find first matching "src" value.
      // This is necessary, because when you set an src attribute, the browser will preload the image
      // before any javascript or even CSS is applied.
      if (srcset) {
        pxRatio = window.devicePixelRatio || 1;
        windowWidth = window.innerWidth * pxRatio;

        temp = srcset.split(",").map(function(el) {
          var ret = {};

          el
            .trim()
            .split(/\s+/)
            .forEach(function(el, i) {
              var value = parseInt(el.substring(0, el.length - 1), 10);

              if (i === 0) {
                return (ret.url = el);
              }

              if (value) {
                ret.value = value;
                ret.postfix = el[el.length - 1];
              }
            });

          return ret;
        });

        // Sort by value
        temp.sort(function(a, b) {
          return a.value - b.value;
        });

        // Ok, now we have an array of all srcset values
        for (var j = 0; j < temp.length; j++) {
          var el = temp[j];

          if ((el.postfix === "w" && el.value >= windowWidth) || (el.postfix === "x" && el.value >= pxRatio)) {
            found = el;
            break;
          }
        }

        // If not found, take the last one
        if (!found && temp.length) {
          found = temp[temp.length - 1];
        }

        if (found) {
          slide.src = found.url;

          // If we have default width/height values, we can calculate height for matching source
          if (slide.width && slide.height && found.postfix == "w") {
            slide.height = slide.width / slide.height * found.value;
            slide.width = found.value;
          }

          slide.opts.srcset = srcset;
        }
      }

      // This will be wrapper containing both ghost and actual image
      slide.$content = $('<div class="fancybox-content"></div>')
        .addClass("fancybox-is-hidden")
        .appendTo(slide.$slide.addClass("fancybox-slide--image"));

      // If we have a thumbnail, we can display it while actual image is loading
      // Users will not stare at black screen and actual image will appear gradually
      thumbSrc = slide.opts.thumb || (slide.opts.$thumb && slide.opts.$thumb.length ? slide.opts.$thumb.attr("src") : false);

      if (slide.opts.preload !== false && slide.opts.width && slide.opts.height && thumbSrc) {
        slide.width = slide.opts.width;
        slide.height = slide.opts.height;

        slide.$ghost = $("<img />")
          .one("error", function() {
            $(this).remove();

            slide.$ghost = null;
          })
          .one("load", function() {
            self.afterLoad(slide);
          })
          .addClass("fancybox-image")
          .appendTo(slide.$content)
          .attr("src", thumbSrc);
      }

      // Start loading actual image
      self.setBigImage(slide);
    },

    // Create full-size image
    // ======================

    setBigImage: function(slide) {
      var self = this,
        $img = $("<img />");

      slide.$image = $img
        .one("error", function() {
          self.setError(slide);
        })
        .one("load", function() {
          var sizes;

          if (!slide.$ghost) {
            self.resolveImageSlideSize(slide, this.naturalWidth, this.naturalHeight);

            self.afterLoad(slide);
          }

          // Clear timeout that checks if loading icon needs to be displayed
          if (slide.timouts) {
            clearTimeout(slide.timouts);
            slide.timouts = null;
          }

          if (self.isClosing) {
            return;
          }

          if (slide.opts.srcset) {
            sizes = slide.opts.sizes;

            if (!sizes || sizes === "auto") {
              sizes =
                (slide.width / slide.height > 1 && $W.width() / $W.height() > 1 ? "100" : Math.round(slide.width / slide.height * 100)) +
                "vw";
            }

            $img.attr("sizes", sizes).attr("srcset", slide.opts.srcset);
          }

          // Hide temporary image after some delay
          if (slide.$ghost) {
            setTimeout(function() {
              if (slide.$ghost && !self.isClosing) {
                slide.$ghost.hide();
              }
            }, Math.min(300, Math.max(1000, slide.height / 1600)));
          }

          self.hideLoading(slide);
        })
        .addClass("fancybox-image")
        .attr("src", slide.src)
        .appendTo(slide.$content);

      if (($img[0].complete || $img[0].readyState == "complete") && $img[0].naturalWidth && $img[0].naturalHeight) {
        $img.trigger("load");
      } else if ($img[0].error) {
        $img.trigger("error");
      }
    },

    // Computes the slide size from image size and maxWidth/maxHeight
    // ==============================================================

    resolveImageSlideSize: function(slide, imgWidth, imgHeight) {
      var maxWidth = parseInt(slide.opts.width, 10),
        maxHeight = parseInt(slide.opts.height, 10);

      // Sets the default values from the image
      slide.width = imgWidth;
      slide.height = imgHeight;

      if (maxWidth > 0) {
        slide.width = maxWidth;
        slide.height = Math.floor(maxWidth * imgHeight / imgWidth);
      }

      if (maxHeight > 0) {
        slide.width = Math.floor(maxHeight * imgWidth / imgHeight);
        slide.height = maxHeight;
      }
    },

    // Create iframe wrapper, iframe and bindings
    // ==========================================

    setIframe: function(slide) {
      var self = this,
        opts = slide.opts.iframe,
        $slide = slide.$slide,
        $iframe;

      slide.$content = $('<div class="fancybox-content' + (opts.preload ? " fancybox-is-hidden" : "") + '"></div>')
        .css(opts.css)
        .appendTo($slide);

      $slide.addClass("fancybox-slide--" + slide.contentType);

      slide.$iframe = $iframe = $(opts.tpl.replace(/\{rnd\}/g, new Date().getTime()))
        .attr(opts.attr)
        .appendTo(slide.$content);

      if (opts.preload) {
        self.showLoading(slide);

        // Unfortunately, it is not always possible to determine if iframe is successfully loaded
        // (due to browser security policy)

        $iframe.on("load.fb error.fb", function(e) {
          this.isReady = 1;

          slide.$slide.trigger("refresh");

          self.afterLoad(slide);
        });

        // Recalculate iframe content size
        // ===============================

        $slide.on("refresh.fb", function() {
          var $content = slide.$content,
            frameWidth = opts.css.width,
            frameHeight = opts.css.height,
            $contents,
            $body;

          if ($iframe[0].isReady !== 1) {
            return;
          }

          try {
            $contents = $iframe.contents();
            $body = $contents.find("body");
          } catch (ignore) {}

          // Calculate contnet dimensions if it is accessible
          if ($body && $body.length && $body.children().length) {
            $content.css({
              width: "",
              height: ""
            });

            if (frameWidth === undefined) {
              frameWidth = Math.ceil(Math.max($body[0].clientWidth, $body.outerWidth(true)));
            }

            if (frameWidth) {
              $content.width(frameWidth);
            }

            if (frameHeight === undefined) {
              frameHeight = Math.ceil(Math.max($body[0].clientHeight, $body.outerHeight(true)));
            }

            if (frameHeight) {
              $content.height(frameHeight);
            }
          }

          $content.removeClass("fancybox-is-hidden");
        });
      } else {
        this.afterLoad(slide);
      }

      $iframe.attr("src", slide.src);

      // Remove iframe if closing or changing gallery item
      $slide.one("onReset", function() {
        // This helps IE not to throw errors when closing
        try {
          $(this)
            .find("iframe")
            .hide()
            .unbind()
            .attr("src", "//about:blank");
        } catch (ignore) {}

        $(this)
          .off("refresh.fb")
          .empty();

        slide.isLoaded = false;
      });
    },

    // Wrap and append content to the slide
    // ======================================

    setContent: function(slide, content) {
      var self = this;

      if (self.isClosing) {
        return;
      }

      self.hideLoading(slide);

      if (slide.$content) {
        $.fancybox.stop(slide.$content);
      }

      slide.$slide.empty();

      // If content is a jQuery object, then it will be moved to the slide.
      // The placeholder is created so we will know where to put it back.
      if (isQuery(content) && content.parent().length) {
        // Make sure content is not already moved to fancyBox
        content
          .parent()
          .parent(".fancybox-slide--inline")
          .trigger("onReset");

        // Create temporary element marking original place of the content
        slide.$placeholder = $("<div>")
          .hide()
          .insertAfter(content);

        // Make sure content is visible
        content.css("display", "inline-block");
      } else if (!slide.hasError) {
        // If content is just a plain text, try to convert it to html
        if ($.type(content) === "string") {
          content = $("<div>")
            .append($.trim(content))
            .contents();

          // If we have text node, then add wrapping element to make vertical alignment work
          if (content[0].nodeType === 3) {
            content = $("<div>").html(content);
          }
        }

        // If "filter" option is provided, then filter content
        if (slide.opts.filter) {
          content = $("<div>")
            .html(content)
            .find(slide.opts.filter);
        }
      }

      slide.$slide.one("onReset", function() {
        // Pause all html5 video/audio
        $(this)
          .find("video,audio")
          .trigger("pause");

        // Put content back
        if (slide.$placeholder) {
          slide.$placeholder.after(content.hide()).remove();

          slide.$placeholder = null;
        }

        // Remove custom close button
        if (slide.$smallBtn) {
          slide.$smallBtn.remove();

          slide.$smallBtn = null;
        }

        // Remove content and mark slide as not loaded
        if (!slide.hasError) {
          $(this).empty();

          slide.isLoaded = false;
        }
      });

      $(content).appendTo(slide.$slide);

      if ($(content).is("video,audio")) {
        $(content).addClass("fancybox-video");

        $(content).wrap("<div></div>");

        slide.contentType = "video";

        slide.opts.width = slide.opts.width || $(content).attr("width");
        slide.opts.height = slide.opts.height || $(content).attr("height");
      }

      slide.$content = slide.$slide
        .children()
        .filter("div,form,main,video,audio")
        .first()
        .addClass("fancybox-content");

      slide.$slide.addClass("fancybox-slide--" + slide.contentType);

      this.afterLoad(slide);
    },

    // Display error message
    // =====================

    setError: function(slide) {
      slide.hasError = true;

      slide.$slide
        .trigger("onReset")
        .removeClass("fancybox-slide--" + slide.contentType)
        .addClass("fancybox-slide--error");

      slide.contentType = "html";

      this.setContent(slide, this.translate(slide, slide.opts.errorTpl));

      if (slide.pos === this.currPos) {
        this.isAnimating = false;
      }
    },

    // Show loading icon inside the slide
    // ==================================

    showLoading: function(slide) {
      var self = this;

      slide = slide || self.current;

      if (slide && !slide.$spinner) {
        slide.$spinner = $(self.translate(self, self.opts.spinnerTpl)).appendTo(slide.$slide);
      }
    },

    // Remove loading icon from the slide
    // ==================================

    hideLoading: function(slide) {
      var self = this;

      slide = slide || self.current;

      if (slide && slide.$spinner) {
        slide.$spinner.remove();

        delete slide.$spinner;
      }
    },

    // Adjustments after slide content has been loaded
    // ===============================================

    afterLoad: function(slide) {
      var self = this;

      if (self.isClosing) {
        return;
      }

      slide.isLoading = false;
      slide.isLoaded = true;

      self.trigger("afterLoad", slide);

      self.hideLoading(slide);

      if (slide.pos === self.currPos) {
        self.updateCursor();
      }

      if (slide.opts.smallBtn && (!slide.$smallBtn || !slide.$smallBtn.length)) {
        slide.$smallBtn = $(self.translate(slide, slide.opts.btnTpl.smallBtn)).prependTo(slide.$content);
      }

      if (slide.opts.protect && slide.$content && !slide.hasError) {
        // Disable right click
        slide.$content.on("contextmenu.fb", function(e) {
          if (e.button == 2) {
            e.preventDefault();
          }

          return true;
        });

        // Add fake element on top of the image
        // This makes a bit harder for user to select image
        if (slide.type === "image") {
          $('<div class="fancybox-spaceball"></div>').appendTo(slide.$content);
        }
      }

      self.revealContent(slide);
    },

    // Make content visible
    // This method is called right after content has been loaded or
    // user navigates gallery and transition should start
    // ============================================================

    revealContent: function(slide) {
      var self = this,
        $slide = slide.$slide,
        end = false,
        start = false,
        effect,
        effectClassName,
        duration,
        opacity;

      effect = slide.opts[self.firstRun ? "animationEffect" : "transitionEffect"];
      duration = slide.opts[self.firstRun ? "animationDuration" : "transitionDuration"];

      duration = parseInt(slide.forcedDuration === undefined ? duration : slide.forcedDuration, 10);

      // Do not animate if revealing the same slide
      if (slide.pos === self.currPos) {
        if (slide.isComplete) {
          effect = false;
        } else {
          self.isAnimating = true;
        }
      }

      if (slide.isMoved || slide.pos !== self.currPos || !duration) {
        effect = false;
      }

      // Check if can zoom
      if (effect === "zoom") {
        if (slide.pos === self.currPos && duration && slide.type === "image" && !slide.hasError && (start = self.getThumbPos(slide))) {
          end = self.getFitPos(slide);
        } else {
          effect = "fade";
        }
      }

      // Zoom animation
      // ==============
      if (effect === "zoom") {
        end.scaleX = end.width / start.width;
        end.scaleY = end.height / start.height;

        // Check if we need to animate opacity
        opacity = slide.opts.zoomOpacity;

        if (opacity == "auto") {
          opacity = Math.abs(slide.width / slide.height - start.width / start.height) > 0.1;
        }

        if (opacity) {
          start.opacity = 0.1;
          end.opacity = 1;
        }

        // Draw image at start position
        $.fancybox.setTranslate(slide.$content.removeClass("fancybox-is-hidden"), start);

        forceRedraw(slide.$content);

        // Start animation
        $.fancybox.animate(slide.$content, end, duration, function() {
          self.isAnimating = false;

          self.complete();
        });

        return;
      }

      self.updateSlide(slide);

      // Simply show content
      // ===================

      if (!effect) {
        forceRedraw($slide);

        slide.$content.removeClass("fancybox-is-hidden");

        if (slide.pos === self.currPos) {
          self.complete();
        }

        return;
      }

      $.fancybox.stop($slide);

      effectClassName = "fancybox-animated fancybox-slide--" + (slide.pos >= self.prevPos ? "next" : "previous") + " fancybox-fx-" + effect;

      $slide
        .removeAttr("style")
        .removeClass("fancybox-slide--current fancybox-slide--next fancybox-slide--previous")
        .addClass(effectClassName);

      slide.$content.removeClass("fancybox-is-hidden");

      // Force reflow for CSS3 transitions
      forceRedraw($slide);

      $.fancybox.animate(
        $slide,
        "fancybox-slide--current",
        duration,
        function(e) {
          $slide.removeClass(effectClassName).removeAttr("style");

          if (slide.pos === self.currPos) {
            self.complete();
          }
        },
        true
      );
    },

    // Check if we can and have to zoom from thumbnail
    //================================================

    getThumbPos: function(slide) {
      var self = this,
        rez = false,
        $thumb = slide.opts.$thumb,
        thumbPos = $thumb && $thumb.length && $thumb[0].ownerDocument === document ? $thumb.offset() : 0,
        slidePos;

      // Check if element is inside the viewport by at least 1 pixel
      var isElementVisible = function($el) {
        var element = $el[0],
          elementRect = element.getBoundingClientRect(),
          parentRects = [],
          visibleInAllParents;

        while (element.parentElement !== null) {
          if ($(element.parentElement).css("overflow") === "hidden" || $(element.parentElement).css("overflow") === "auto") {
            parentRects.push(element.parentElement.getBoundingClientRect());
          }

          element = element.parentElement;
        }

        visibleInAllParents = parentRects.every(function(parentRect) {
          var visiblePixelX = Math.min(elementRect.right, parentRect.right) - Math.max(elementRect.left, parentRect.left);
          var visiblePixelY = Math.min(elementRect.bottom, parentRect.bottom) - Math.max(elementRect.top, parentRect.top);

          return visiblePixelX > 0 && visiblePixelY > 0;
        });

        return (
          visibleInAllParents &&
          elementRect.bottom > 0 &&
          elementRect.right > 0 &&
          elementRect.left < $(window).width() &&
          elementRect.top < $(window).height()
        );
      };

      if (thumbPos && isElementVisible($thumb)) {
        slidePos = self.$refs.stage.offset();

        rez = {
          top: thumbPos.top - slidePos.top + parseFloat($thumb.css("border-top-width") || 0),
          left: thumbPos.left - slidePos.left + parseFloat($thumb.css("border-left-width") || 0),
          width: $thumb.width(),
          height: $thumb.height(),
          scaleX: 1,
          scaleY: 1
        };
      }

      return rez;
    },

    // Final adjustments after current gallery item is moved to position
    // and it`s content is loaded
    // ==================================================================

    complete: function() {
      var self = this,
        current = self.current,
        slides = {};

      if (current.isMoved || !current.isLoaded) {
        return;
      }

      if (!current.isComplete) {
        current.isComplete = true;

        current.$slide.siblings().trigger("onReset");

        self.preload("inline");

        // Trigger any CSS3 transiton inside the slide
        forceRedraw(current.$slide);

        current.$slide.addClass("fancybox-slide--complete");

        // Remove unnecessary slides
        $.each(self.slides, function(key, slide) {
          if (slide.pos >= self.currPos - 1 && slide.pos <= self.currPos + 1) {
            slides[slide.pos] = slide;
          } else if (slide) {
            $.fancybox.stop(slide.$slide);

            slide.$slide.off().remove();
          }
        });

        self.slides = slides;
      }

      self.isAnimating = false;

      self.updateCursor();

      self.trigger("afterShow");

      // Play first html5 video/audio
      current.$slide
        .find("video,audio")
        .filter(":visible:first")
        .trigger("play");

      // Try to focus on the first focusable element
      if (
        $(document.activeElement).is("[disabled]") ||
        (current.opts.autoFocus && !(current.type == "image" || current.type === "iframe"))
      ) {
        self.focus();
      }
    },

    // Preload next and previous slides
    // ================================

    preload: function(type) {
      var self = this,
        next = self.slides[self.currPos + 1],
        prev = self.slides[self.currPos - 1];

      if (next && next.type === type) {
        self.loadSlide(next);
      }

      if (prev && prev.type === type) {
        self.loadSlide(prev);
      }
    },

    // Try to find and focus on the first focusable element
    // ====================================================

    focus: function() {
      var current = this.current,
        $el;

      if (this.isClosing) {
        return;
      }

      if (current && current.isComplete && current.$content) {
        // Look for first input with autofocus attribute
        $el = current.$content.find("input[autofocus]:enabled:visible:first");

        if (!$el.length) {
          $el = current.$content.find("button,:input,[tabindex],a").filter(":enabled:visible:first");
        }

        $el = $el && $el.length ? $el : current.$content;

        $el.trigger("focus");
      }
    },

    // Activates current instance - brings container to the front and enables keyboard,
    // notifies other instances about deactivating
    // =================================================================================

    activate: function() {
      var self = this;

      // Deactivate all instances
      $(".fancybox-container").each(function() {
        var instance = $(this).data("FancyBox");

        // Skip self and closing instances
        if (instance && instance.id !== self.id && !instance.isClosing) {
          instance.trigger("onDeactivate");

          instance.removeEvents();

          instance.isVisible = false;
        }
      });

      self.isVisible = true;

      if (self.current || self.isIdle) {
        self.update();

        self.updateControls();
      }

      self.trigger("onActivate");

      self.addEvents();
    },

    // Start closing procedure
    // This will start "zoom-out" animation if needed and clean everything up afterwards
    // =================================================================================

    close: function(e, d) {
      var self = this,
        current = self.current,
        effect,
        duration,
        $content,
        domRect,
        opacity,
        start,
        end;

      var done = function() {
        self.cleanUp(e);
      };

      if (self.isClosing) {
        return false;
      }

      self.isClosing = true;

      // If beforeClose callback prevents closing, make sure content is centered
      if (self.trigger("beforeClose", e) === false) {
        self.isClosing = false;

        requestAFrame(function() {
          self.update();
        });

        return false;
      }

      // Remove all events
      // If there are multiple instances, they will be set again by "activate" method
      self.removeEvents();

      if (current.timouts) {
        clearTimeout(current.timouts);
      }

      $content = current.$content;
      effect = current.opts.animationEffect;
      duration = $.isNumeric(d) ? d : effect ? current.opts.animationDuration : 0;

      // Remove other slides
      current.$slide
        .off(transitionEnd)
        .removeClass("fancybox-slide--complete fancybox-slide--next fancybox-slide--previous fancybox-animated");

      current.$slide
        .siblings()
        .trigger("onReset")
        .remove();

      // Trigger animations
      if (duration) {
        self.$refs.container.removeClass("fancybox-is-open").addClass("fancybox-is-closing");
      }

      // Clean up
      self.hideLoading(current);

      self.hideControls();

      self.updateCursor();

      // Check if possible to zoom-out
      if (
        effect === "zoom" &&
        !(e !== true && $content && duration && current.type === "image" && !current.hasError && (end = self.getThumbPos(current)))
      ) {
        effect = "fade";
      }

      if (effect === "zoom") {
        $.fancybox.stop($content);

        domRect = $.fancybox.getTranslate($content);

        start = {
          top: domRect.top,
          left: domRect.left,
          scaleX: domRect.width / end.width,
          scaleY: domRect.height / end.height,
          width: end.width,
          height: end.height
        };

        // Check if we need to animate opacity
        opacity = current.opts.zoomOpacity;

        if (opacity == "auto") {
          opacity = Math.abs(current.width / current.height - end.width / end.height) > 0.1;
        }

        if (opacity) {
          end.opacity = 0;
        }

        $.fancybox.setTranslate($content, start);

        forceRedraw($content);

        $.fancybox.animate($content, end, duration, done);

        return true;
      }

      if (effect && duration) {
        // If skip animation
        if (e === true) {
          setTimeout(done, duration);
        } else {
          $.fancybox.animate(
            current.$slide.removeClass("fancybox-slide--current"),
            "fancybox-animated fancybox-slide--previous fancybox-fx-" + effect,
            duration,
            done
          );
        }
      } else {
        done();
      }

      return true;
    },

    // Final adjustments after removing the instance
    // =============================================

    cleanUp: function(e) {
      var self = this,
        $body = $("body"),
        instance,
        scrollTop;

      self.current.$slide.trigger("onReset");

      self.$refs.container.empty().remove();

      self.trigger("afterClose", e);

      // Place back focus
      if (self.$lastFocus && !!self.current.opts.backFocus) {
        self.$lastFocus.trigger("focus");
      }

      self.current = null;

      // Check if there are other instances
      instance = $.fancybox.getInstance();

      if (instance) {
        instance.activate();
      } else {
        $body.removeClass("fancybox-active compensate-for-scrollbar");

        $("#fancybox-style-noscroll").remove();
      }
    },

    // Call callback and trigger an event
    // ==================================

    trigger: function(name, slide) {
      var args = Array.prototype.slice.call(arguments, 1),
        self = this,
        obj = slide && slide.opts ? slide : self.current,
        rez;

      if (obj) {
        args.unshift(obj);
      } else {
        obj = self;
      }

      args.unshift(self);

      if ($.isFunction(obj.opts[name])) {
        rez = obj.opts[name].apply(obj, args);
      }

      if (rez === false) {
        return rez;
      }

      if (name === "afterClose" || !self.$refs) {
        $D.trigger(name + ".fb", args);
      } else {
        self.$refs.container.trigger(name + ".fb", args);
      }
    },

    // Update infobar values, navigation button states and reveal caption
    // ==================================================================

    updateControls: function(force) {
      var self = this,
        current = self.current,
        index = current.index,
        caption = current.opts.caption,
        $container = self.$refs.container,
        $caption = self.$refs.caption;

      // Recalculate content dimensions
      current.$slide.trigger("refresh");

      self.$caption = caption && caption.length ? $caption.html(caption) : null;

      if (!self.isHiddenControls && !self.isIdle) {
        self.showControls();
      }

      // Update info and navigation elements
      $container.find("[data-fancybox-count]").html(self.group.length);
      $container.find("[data-fancybox-index]").html(index + 1);

      $container.find("[data-fancybox-prev]").toggleClass("disabled", !current.opts.loop && index <= 0);
      $container.find("[data-fancybox-next]").toggleClass("disabled", !current.opts.loop && index >= self.group.length - 1);

      if (current.type === "image") {
        // Re-enable buttons; update download button source
        $container
          .find("[data-fancybox-zoom]")
          .show()
          .end()
          .find("[data-fancybox-download]")
          .attr("href", current.opts.image.src || current.src)
          .show();
      } else if (current.opts.toolbar) {
        $container.find("[data-fancybox-download],[data-fancybox-zoom]").hide();
      }
    },

    // Hide toolbar and caption
    // ========================

    hideControls: function() {
      this.isHiddenControls = true;

      this.$refs.container.removeClass("fancybox-show-infobar fancybox-show-toolbar fancybox-show-caption fancybox-show-nav");
    },

    showControls: function() {
      var self = this,
        opts = self.current ? self.current.opts : self.opts,
        $container = self.$refs.container;

      self.isHiddenControls = false;
      self.idleSecondsCounter = 0;

      $container
        .toggleClass("fancybox-show-toolbar", !!(opts.toolbar && opts.buttons))
        .toggleClass("fancybox-show-infobar", !!(opts.infobar && self.group.length > 1))
        .toggleClass("fancybox-show-nav", !!(opts.arrows && self.group.length > 1))
        .toggleClass("fancybox-is-modal", !!opts.modal);

      if (self.$caption) {
        $container.addClass("fancybox-show-caption ");
      } else {
        $container.removeClass("fancybox-show-caption");
      }
    },

    // Toggle toolbar and caption
    // ==========================

    toggleControls: function() {
      if (this.isHiddenControls) {
        this.showControls();
      } else {
        this.hideControls();
      }
    }
  });

  $.fancybox = {
    version: "3.3.5",
    defaults: defaults,

    // Get current instance and execute a command.
    //
    // Examples of usage:
    //
    //   $instance = $.fancybox.getInstance();
    //   $.fancybox.getInstance().jumpTo( 1 );
    //   $.fancybox.getInstance( 'jumpTo', 1 );
    //   $.fancybox.getInstance( function() {
    //       console.info( this.currIndex );
    //   });
    // ======================================================

    getInstance: function(command) {
      var instance = $('.fancybox-container:not(".fancybox-is-closing"):last').data("FancyBox"),
        args = Array.prototype.slice.call(arguments, 1);

      if (instance instanceof FancyBox) {
        if ($.type(command) === "string") {
          instance[command].apply(instance, args);
        } else if ($.type(command) === "function") {
          command.apply(instance, args);
        }

        return instance;
      }

      return false;
    },

    // Create new instance
    // ===================

    open: function(items, opts, index) {
      return new FancyBox(items, opts, index);
    },

    // Close current or all instances
    // ==============================

    close: function(all) {
      var instance = this.getInstance();

      if (instance) {
        instance.close();

        // Try to find and close next instance

        if (all === true) {
          this.close();
        }
      }
    },

    // Close all instances and unbind all events
    // =========================================

    destroy: function() {
      this.close(true);

      $D.add("body").off("click.fb-start", "**");
    },

    // Try to detect mobile devices
    // ============================

    isMobile:
      document.createTouch !== undefined && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),

    // Detect if 'translate3d' support is available
    // ============================================

    use3d: (function() {
      var div = document.createElement("div");

      return (
        window.getComputedStyle &&
        window.getComputedStyle(div) &&
        window.getComputedStyle(div).getPropertyValue("transform") &&
        !(document.documentMode && document.documentMode < 11)
      );
    })(),

    // Helper function to get current visual state of an element
    // returns array[ top, left, horizontal-scale, vertical-scale, opacity ]
    // =====================================================================

    getTranslate: function($el) {
      var domRect;

      if (!$el || !$el.length) {
        return false;
      }

      domRect = $el[0].getBoundingClientRect();

      return {
        top: domRect.top || 0,
        left: domRect.left || 0,
        width: domRect.width,
        height: domRect.height,
        opacity: parseFloat($el.css("opacity"))
      };
    },

    // Shortcut for setting "translate3d" properties for element
    // Can set be used to set opacity, too
    // ========================================================

    setTranslate: function($el, props) {
      var str = "",
        css = {};

      if (!$el || !props) {
        return;
      }

      if (props.left !== undefined || props.top !== undefined) {
        str =
          (props.left === undefined ? $el.position().left : props.left) +
          "px, " +
          (props.top === undefined ? $el.position().top : props.top) +
          "px";

        if (this.use3d) {
          str = "translate3d(" + str + ", 0px)";
        } else {
          str = "translate(" + str + ")";
        }
      }

      if (props.scaleX !== undefined && props.scaleY !== undefined) {
        str = (str.length ? str + " " : "") + "scale(" + props.scaleX + ", " + props.scaleY + ")";
      }

      if (str.length) {
        css.transform = str;
      }

      if (props.opacity !== undefined) {
        css.opacity = props.opacity;
      }

      if (props.width !== undefined) {
        css.width = props.width;
      }

      if (props.height !== undefined) {
        css.height = props.height;
      }

      return $el.css(css);
    },

    // Simple CSS transition handler
    // =============================

    animate: function($el, to, duration, callback, leaveAnimationName) {
      var final = false;

      if ($.isFunction(duration)) {
        callback = duration;
        duration = null;
      }

      if (!$.isPlainObject(to)) {
        $el.removeAttr("style");
      }

      $.fancybox.stop($el);

      $el.on(transitionEnd, function(e) {
        // Skip events from child elements and z-index change
        if (e && e.originalEvent && (!$el.is(e.originalEvent.target) || e.originalEvent.propertyName == "z-index")) {
          return;
        }

        $.fancybox.stop($el);

        if (final) {
          $.fancybox.setTranslate($el, final);
        }

        if ($.isPlainObject(to)) {
          if (leaveAnimationName === false) {
            $el.removeAttr("style");
          }
        } else if (leaveAnimationName !== true) {
          $el.removeClass(to);
        }

        if ($.isFunction(callback)) {
          callback(e);
        }
      });

      if ($.isNumeric(duration)) {
        $el.css("transition-duration", duration + "ms");
      }

      // Start animation by changing CSS properties or class name
      if ($.isPlainObject(to)) {
        if (to.scaleX !== undefined && to.scaleY !== undefined) {
          final = $.extend({}, to, {
            width: $el.width() * to.scaleX,
            height: $el.height() * to.scaleY,
            scaleX: 1,
            scaleY: 1
          });

          delete to.width;
          delete to.height;

          if ($el.parent().hasClass("fancybox-slide--image")) {
            $el.parent().addClass("fancybox-is-scaling");
          }
        }

        $.fancybox.setTranslate($el, to);
      } else {
        $el.addClass(to);
      }

      // Make sure that `transitionend` callback gets fired
      $el.data(
        "timer",
        setTimeout(function() {
          $el.trigger("transitionend");
        }, duration + 16)
      );
    },

    stop: function($el) {
      if ($el && $el.length) {
        clearTimeout($el.data("timer"));

        $el.off("transitionend").css("transition-duration", "");

        $el.parent().removeClass("fancybox-is-scaling");
      }
    }
  };

  // Default click handler for "fancyboxed" links
  // ============================================

  function _run(e, opts) {
    var items = [],
      index = 0,
      $target,
      value;

    // Avoid opening multiple times
    if (e && e.isDefaultPrevented()) {
      return;
    }

    e.preventDefault();

    opts = e && e.data ? e.data.options : opts || {};

    $target = opts.$target || $(e.currentTarget);
    value = $target.attr("data-fancybox") || "";

    // Get all related items and find index for clicked one
    if (value) {
      items = opts.selector ? $(opts.selector) : e.data ? e.data.items : [];
      items = items.length ? items.filter('[data-fancybox="' + value + '"]') : $('[data-fancybox="' + value + '"]');

      index = items.index($target);

      // Sometimes current item can not be found (for example, if some script clones items)
      if (index < 0) {
        index = 0;
      }
    } else {
      items = [$target];
    }

    $.fancybox.open(items, opts, index);
  }

  // Create a jQuery plugin
  // ======================

  $.fn.fancybox = function(options) {
    var selector;

    options = options || {};
    selector = options.selector || false;

    if (selector) {
      // Use body element instead of document so it executes first
      $("body")
        .off("click.fb-start", selector)
        .on("click.fb-start", selector, {options: options}, _run);
    } else {
      this.off("click.fb-start").on(
        "click.fb-start",
        {
          items: this,
          options: options
        },
        _run
      );
    }

    return this;
  };

  // Self initializing plugin for all elements having `data-fancybox` attribute
  // ==========================================================================

  $D.on("click.fb-start", "[data-fancybox]", _run);

  // Enable "trigger elements"
  // =========================

  $D.on("click.fb-start", "[data-trigger]", function(e) {
    _run(e, {
      $target: $('[data-fancybox="' + $(e.currentTarget).attr("data-trigger") + '"]').eq($(e.currentTarget).attr("data-index") || 0),
      $trigger: $(this)
    });
  });
})(window, document, window.jQuery || jQuery);

// ==========================================================================
//
// Media
// Adds additional media type support
//
// ==========================================================================
(function($) {
  "use strict";

  // Formats matching url to final form

  var format = function(url, rez, params) {
    if (!url) {
      return;
    }

    params = params || "";

    if ($.type(params) === "object") {
      params = $.param(params, true);
    }

    $.each(rez, function(key, value) {
      url = url.replace("$" + key, value || "");
    });

    if (params.length) {
      url += (url.indexOf("?") > 0 ? "&" : "?") + params;
    }

    return url;
  };

  // Object containing properties for each media type

  var defaults = {
    youtube: {
      matcher: /(youtube\.com|youtu\.be|youtube\-nocookie\.com)\/(watch\?(.*&)?v=|v\/|u\/|embed\/?)?(videoseries\?list=(.*)|[\w-]{11}|\?listType=(.*)&list=(.*))(.*)/i,
      params: {
        autoplay: 1,
        autohide: 1,
        fs: 1,
        rel: 0,
        hd: 1,
        wmode: "transparent",
        enablejsapi: 1,
        html5: 1
      },
      paramPlace: 8,
      type: "iframe",
      url: "//www.youtube.com/embed/$4",
      thumb: "//img.youtube.com/vi/$4/hqdefault.jpg"
    },

    vimeo: {
      matcher: /^.+vimeo.com\/(.*\/)?([\d]+)(.*)?/,
      params: {
        autoplay: 1,
        hd: 1,
        show_title: 1,
        show_byline: 1,
        show_portrait: 0,
        fullscreen: 1,
        api: 1
      },
      paramPlace: 3,
      type: "iframe",
      url: "//player.vimeo.com/video/$2"
    },

    instagram: {
      matcher: /(instagr\.am|instagram\.com)\/p\/([a-zA-Z0-9_\-]+)\/?/i,
      type: "image",
      url: "//$1/p/$2/media/?size=l"
    },

    // Examples:
    // http://maps.google.com/?ll=48.857995,2.294297&spn=0.007666,0.021136&t=m&z=16
    // https://www.google.com/maps/@37.7852006,-122.4146355,14.65z
    // https://www.google.com/maps/@52.2111123,2.9237542,6.61z?hl=en
    // https://www.google.com/maps/place/Googleplex/@37.4220041,-122.0833494,17z/data=!4m5!3m4!1s0x0:0x6c296c66619367e0!8m2!3d37.4219998!4d-122.0840572
    gmap_place: {
      matcher: /(maps\.)?google\.([a-z]{2,3}(\.[a-z]{2})?)\/(((maps\/(place\/(.*)\/)?\@(.*),(\d+.?\d+?)z))|(\?ll=))(.*)?/i,
      type: "iframe",
      url: function(rez) {
        return (
          "//maps.google." +
          rez[2] +
          "/?ll=" +
          (rez[9] ? rez[9] + "&z=" + Math.floor(rez[10]) + (rez[12] ? rez[12].replace(/^\//, "&") : "") : rez[12] + "").replace(/\?/, "&") +
          "&output=" +
          (rez[12] && rez[12].indexOf("layer=c") > 0 ? "svembed" : "embed")
        );
      }
    },

    // Examples:
    // https://www.google.com/maps/search/Empire+State+Building/
    // https://www.google.com/maps/search/?api=1&query=centurylink+field
    // https://www.google.com/maps/search/?api=1&query=47.5951518,-122.3316393
    gmap_search: {
      matcher: /(maps\.)?google\.([a-z]{2,3}(\.[a-z]{2})?)\/(maps\/search\/)(.*)/i,
      type: "iframe",
      url: function(rez) {
        return "//maps.google." + rez[2] + "/maps?q=" + rez[5].replace("query=", "q=").replace("api=1", "") + "&output=embed";
      }
    }
  };

  $(document).on("objectNeedsType.fb", function(e, instance, item) {
    var url = item.src || "",
      type = false,
      media,
      thumb,
      rez,
      params,
      urlParams,
      paramObj,
      provider;

    media = $.extend(true, {}, defaults, item.opts.media);

    // Look for any matching media type
    $.each(media, function(providerName, providerOpts) {
      rez = url.match(providerOpts.matcher);

      if (!rez) {
        return;
      }

      type = providerOpts.type;
      provider = providerName;
      paramObj = {};

      if (providerOpts.paramPlace && rez[providerOpts.paramPlace]) {
        urlParams = rez[providerOpts.paramPlace];

        if (urlParams[0] == "?") {
          urlParams = urlParams.substring(1);
        }

        urlParams = urlParams.split("&");

        for (var m = 0; m < urlParams.length; ++m) {
          var p = urlParams[m].split("=", 2);

          if (p.length == 2) {
            paramObj[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
          }
        }
      }

      params = $.extend(true, {}, providerOpts.params, item.opts[providerName], paramObj);

      url =
        $.type(providerOpts.url) === "function" ? providerOpts.url.call(this, rez, params, item) : format(providerOpts.url, rez, params);

      thumb =
        $.type(providerOpts.thumb) === "function" ? providerOpts.thumb.call(this, rez, params, item) : format(providerOpts.thumb, rez);

      if (providerName === "youtube") {
        url = url.replace(/&t=((\d+)m)?(\d+)s/, function(match, p1, m, s) {
          return "&start=" + ((m ? parseInt(m, 10) * 60 : 0) + parseInt(s, 10));
        });
      } else if (providerName === "vimeo") {
        url = url.replace("&%23", "#");
      }

      return false;
    });

    // If it is found, then change content type and update the url

    if (type) {
      if (!item.opts.thumb && !(item.opts.$thumb && item.opts.$thumb.length)) {
        item.opts.thumb = thumb;
      }

      if (type === "iframe") {
        item.opts = $.extend(true, item.opts, {
          iframe: {
            preload: false,
            attr: {
              scrolling: "no"
            }
          }
        });
      }

      $.extend(item, {
        type: type,
        src: url,
        origSrc: item.src,
        contentSource: provider,
        contentType: type === "image" ? "image" : provider == "gmap_place" || provider == "gmap_search" ? "map" : "video"
      });
    } else if (url) {
      item.type = item.opts.defaultType;
    }
  });
})(window.jQuery || jQuery);

// ==========================================================================
//
// Guestures
// Adds touch guestures, handles click and tap events
//
// ==========================================================================
(function(window, document, $) {
  "use strict";

  var requestAFrame = (function() {
    return (
      window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      // if all else fails, use setTimeout
      function(callback) {
        return window.setTimeout(callback, 1000 / 60);
      }
    );
  })();

  var cancelAFrame = (function() {
    return (
      window.cancelAnimationFrame ||
      window.webkitCancelAnimationFrame ||
      window.mozCancelAnimationFrame ||
      window.oCancelAnimationFrame ||
      function(id) {
        window.clearTimeout(id);
      }
    );
  })();

  var getPointerXY = function(e) {
    var result = [];

    e = e.originalEvent || e || window.e;
    e = e.touches && e.touches.length ? e.touches : e.changedTouches && e.changedTouches.length ? e.changedTouches : [e];

    for (var key in e) {
      if (e[key].pageX) {
        result.push({
          x: e[key].pageX,
          y: e[key].pageY
        });
      } else if (e[key].clientX) {
        result.push({
          x: e[key].clientX,
          y: e[key].clientY
        });
      }
    }

    return result;
  };

  var distance = function(point2, point1, what) {
    if (!point1 || !point2) {
      return 0;
    }

    if (what === "x") {
      return point2.x - point1.x;
    } else if (what === "y") {
      return point2.y - point1.y;
    }

    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
  };

  var isClickable = function($el) {
    if (
      $el.is('a,area,button,[role="button"],input,label,select,summary,textarea,video,audio') ||
      $.isFunction($el.get(0).onclick) ||
      $el.data("selectable")
    ) {
      return true;
    }

    // Check for attributes like data-fancybox-next or data-fancybox-close
    for (var i = 0, atts = $el[0].attributes, n = atts.length; i < n; i++) {
      if (atts[i].nodeName.substr(0, 14) === "data-fancybox-") {
        return true;
      }
    }

    return false;
  };

  var hasScrollbars = function(el) {
    var overflowY = window.getComputedStyle(el)["overflow-y"],
      overflowX = window.getComputedStyle(el)["overflow-x"],
      vertical = (overflowY === "scroll" || overflowY === "auto") && el.scrollHeight > el.clientHeight,
      horizontal = (overflowX === "scroll" || overflowX === "auto") && el.scrollWidth > el.clientWidth;

    return vertical || horizontal;
  };

  var isScrollable = function($el) {
    var rez = false;

    while (true) {
      rez = hasScrollbars($el.get(0));

      if (rez) {
        break;
      }

      $el = $el.parent();

      if (!$el.length || $el.hasClass("fancybox-stage") || $el.is("body")) {
        break;
      }
    }

    return rez;
  };

  var Guestures = function(instance) {
    var self = this;

    self.instance = instance;

    self.$bg = instance.$refs.bg;
    self.$stage = instance.$refs.stage;
    self.$container = instance.$refs.container;

    self.destroy();

    self.$container.on("touchstart.fb.touch mousedown.fb.touch", $.proxy(self, "ontouchstart"));
  };

  Guestures.prototype.destroy = function() {
    this.$container.off(".fb.touch");
  };

  Guestures.prototype.ontouchstart = function(e) {
    var self = this,
      $target = $(e.target),
      instance = self.instance,
      current = instance.current,
      $content = current.$content,
      isTouchDevice = e.type == "touchstart";

    // Do not respond to both (touch and mouse) events
    if (isTouchDevice) {
      self.$container.off("mousedown.fb.touch");
    }

    // Ignore right click
    if (e.originalEvent && e.originalEvent.button == 2) {
      return;
    }

    // Ignore taping on links, buttons, input elements
    if (!$target.length || isClickable($target) || isClickable($target.parent())) {
      return;
    }

    // Ignore clicks on the scrollbar
    if (!$target.is("img") && e.originalEvent.clientX > $target[0].clientWidth + $target.offset().left) {
      return;
    }

    // Ignore clicks while zooming or closing
    if (!current || instance.isAnimating || instance.isClosing) {
      e.stopPropagation();
      e.preventDefault();

      return;
    }

    self.realPoints = self.startPoints = getPointerXY(e);

    if (!self.startPoints.length) {
      return;
    }

    e.stopPropagation();

    self.startEvent = e;

    self.canTap = true;
    self.$target = $target;
    self.$content = $content;
    self.opts = current.opts.touch;

    self.isPanning = false;
    self.isSwiping = false;
    self.isZooming = false;
    self.isScrolling = false;

    self.startTime = new Date().getTime();
    self.distanceX = self.distanceY = self.distance = 0;

    self.canvasWidth = Math.round(current.$slide[0].clientWidth);
    self.canvasHeight = Math.round(current.$slide[0].clientHeight);

    self.contentLastPos = null;
    self.contentStartPos = $.fancybox.getTranslate(self.$content) || {top: 0, left: 0};
    self.sliderStartPos = self.sliderLastPos || $.fancybox.getTranslate(current.$slide);

    // Since position will be absolute, but we need to make it relative to the stage
    self.stagePos = $.fancybox.getTranslate(instance.$refs.stage);

    self.sliderStartPos.top -= self.stagePos.top;
    self.sliderStartPos.left -= self.stagePos.left;

    self.contentStartPos.top -= self.stagePos.top;
    self.contentStartPos.left -= self.stagePos.left;

    $(document)
      .off(".fb.touch")
      .on(isTouchDevice ? "touchend.fb.touch touchcancel.fb.touch" : "mouseup.fb.touch mouseleave.fb.touch", $.proxy(self, "ontouchend"))
      .on(isTouchDevice ? "touchmove.fb.touch" : "mousemove.fb.touch", $.proxy(self, "ontouchmove"));

    if ($.fancybox.isMobile) {
      document.addEventListener("scroll", self.onscroll, true);
    }

    if (!(self.opts || instance.canPan()) || !($target.is(self.$stage) || self.$stage.find($target).length)) {
      if ($target.is(".fancybox-image")) {
        e.preventDefault();
      }

      return;
    }

    if (!($.fancybox.isMobile && (isScrollable($target) || isScrollable($target.parent())))) {
      e.preventDefault();
    }

    if (self.startPoints.length === 1 || current.hasError) {
      if (self.instance.canPan()) {
        $.fancybox.stop(self.$content);

        self.$content.css("transition-duration", "");

        self.isPanning = true;
      } else {
        self.isSwiping = true;
      }

      self.$container.addClass("fancybox-controls--isGrabbing");
    }

    if (self.startPoints.length === 2 && current.type === "image" && (current.isLoaded || current.$ghost)) {
      self.canTap = false;
      self.isSwiping = false;
      self.isPanning = false;

      self.isZooming = true;

      $.fancybox.stop(self.$content);

      self.$content.css("transition-duration", "");

      self.centerPointStartX = (self.startPoints[0].x + self.startPoints[1].x) * 0.5 - $(window).scrollLeft();
      self.centerPointStartY = (self.startPoints[0].y + self.startPoints[1].y) * 0.5 - $(window).scrollTop();

      self.percentageOfImageAtPinchPointX = (self.centerPointStartX - self.contentStartPos.left) / self.contentStartPos.width;
      self.percentageOfImageAtPinchPointY = (self.centerPointStartY - self.contentStartPos.top) / self.contentStartPos.height;

      self.startDistanceBetweenFingers = distance(self.startPoints[0], self.startPoints[1]);
    }
  };

  Guestures.prototype.onscroll = function(e) {
    var self = this;

    self.isScrolling = true;

    document.removeEventListener("scroll", self.onscroll, true);
  };

  Guestures.prototype.ontouchmove = function(e) {
    var self = this,
      $target = $(e.target);

    // Make sure user has not released over iframe or disabled element
    if (e.originalEvent.buttons !== undefined && e.originalEvent.buttons === 0) {
      self.ontouchend(e);
      return;
    }

    if (self.isScrolling || !($target.is(self.$stage) || self.$stage.find($target).length)) {
      self.canTap = false;

      return;
    }

    self.newPoints = getPointerXY(e);

    if (!(self.opts || self.instance.canPan()) || !self.newPoints.length || !self.newPoints.length) {
      return;
    }

    if (!(self.isSwiping && self.isSwiping === true)) {
      e.preventDefault();
    }

    self.distanceX = distance(self.newPoints[0], self.startPoints[0], "x");
    self.distanceY = distance(self.newPoints[0], self.startPoints[0], "y");

    self.distance = distance(self.newPoints[0], self.startPoints[0]);

    // Skip false ontouchmove events (Chrome)
    if (self.distance > 0) {
      if (self.isSwiping) {
        self.onSwipe(e);
      } else if (self.isPanning) {
        self.onPan();
      } else if (self.isZooming) {
        self.onZoom();
      }
    }
  };

  Guestures.prototype.onSwipe = function(e) {
    var self = this,
      swiping = self.isSwiping,
      left = self.sliderStartPos.left || 0,
      angle;

    // If direction is not yet determined
    if (swiping === true) {
      // We need at least 10px distance to correctly calculate an angle
      if (Math.abs(self.distance) > 10) {
        self.canTap = false;

        if (self.instance.group.length < 2 && self.opts.vertical) {
          self.isSwiping = "y";
        } else if (self.instance.isDragging || self.opts.vertical === false || (self.opts.vertical === "auto" && $(window).width() > 800)) {
          self.isSwiping = "x";
        } else {
          angle = Math.abs(Math.atan2(self.distanceY, self.distanceX) * 180 / Math.PI);

          self.isSwiping = angle > 45 && angle < 135 ? "y" : "x";
        }

        self.canTap = false;

        if (self.isSwiping === "y" && $.fancybox.isMobile && (isScrollable(self.$target) || isScrollable(self.$target.parent()))) {
          self.isScrolling = true;

          return;
        }

        self.instance.isDragging = self.isSwiping;

        // Reset points to avoid jumping, because we dropped first swipes to calculate the angle
        self.startPoints = self.newPoints;

        $.each(self.instance.slides, function(index, slide) {
          $.fancybox.stop(slide.$slide);

          slide.$slide.css("transition-duration", "");

          slide.inTransition = false;

          if (slide.pos === self.instance.current.pos) {
            self.sliderStartPos.left = $.fancybox.getTranslate(slide.$slide).left - $.fancybox.getTranslate(self.instance.$refs.stage).left;
          }
        });

        // Stop slideshow
        if (self.instance.SlideShow && self.instance.SlideShow.isActive) {
          self.instance.SlideShow.stop();
        }
      }

      return;
    }

    // Sticky edges
    if (swiping == "x") {
      if (
        self.distanceX > 0 &&
        (self.instance.group.length < 2 || (self.instance.current.index === 0 && !self.instance.current.opts.loop))
      ) {
        left = left + Math.pow(self.distanceX, 0.8);
      } else if (
        self.distanceX < 0 &&
        (self.instance.group.length < 2 ||
          (self.instance.current.index === self.instance.group.length - 1 && !self.instance.current.opts.loop))
      ) {
        left = left - Math.pow(-self.distanceX, 0.8);
      } else {
        left = left + self.distanceX;
      }
    }

    self.sliderLastPos = {
      top: swiping == "x" ? 0 : self.sliderStartPos.top + self.distanceY,
      left: left
    };

    if (self.requestId) {
      cancelAFrame(self.requestId);

      self.requestId = null;
    }

    self.requestId = requestAFrame(function() {
      if (self.sliderLastPos) {
        $.each(self.instance.slides, function(index, slide) {
          var pos = slide.pos - self.instance.currPos;

          $.fancybox.setTranslate(slide.$slide, {
            top: self.sliderLastPos.top,
            left: self.sliderLastPos.left + pos * self.canvasWidth + pos * slide.opts.gutter
          });
        });

        self.$container.addClass("fancybox-is-sliding");
      }
    });
  };

  Guestures.prototype.onPan = function() {
    var self = this;

    // Prevent accidental movement (sometimes, when tapping casually, finger can move a bit)
    if (distance(self.newPoints[0], self.realPoints[0]) < ($.fancybox.isMobile ? 10 : 5)) {
      self.startPoints = self.newPoints;
      return;
    }

    self.canTap = false;

    self.contentLastPos = self.limitMovement();

    if (self.requestId) {
      cancelAFrame(self.requestId);

      self.requestId = null;
    }

    self.requestId = requestAFrame(function() {
      $.fancybox.setTranslate(self.$content, self.contentLastPos);
    });
  };

  // Make panning sticky to the edges
  Guestures.prototype.limitMovement = function() {
    var self = this;

    var canvasWidth = self.canvasWidth;
    var canvasHeight = self.canvasHeight;

    var distanceX = self.distanceX;
    var distanceY = self.distanceY;

    var contentStartPos = self.contentStartPos;

    var currentOffsetX = contentStartPos.left;
    var currentOffsetY = contentStartPos.top;

    var currentWidth = contentStartPos.width;
    var currentHeight = contentStartPos.height;

    var minTranslateX, minTranslateY, maxTranslateX, maxTranslateY, newOffsetX, newOffsetY;

    if (currentWidth > canvasWidth) {
      newOffsetX = currentOffsetX + distanceX;
    } else {
      newOffsetX = currentOffsetX;
    }

    newOffsetY = currentOffsetY + distanceY;

    // Slow down proportionally to traveled distance
    minTranslateX = Math.max(0, canvasWidth * 0.5 - currentWidth * 0.5);
    minTranslateY = Math.max(0, canvasHeight * 0.5 - currentHeight * 0.5);

    maxTranslateX = Math.min(canvasWidth - currentWidth, canvasWidth * 0.5 - currentWidth * 0.5);
    maxTranslateY = Math.min(canvasHeight - currentHeight, canvasHeight * 0.5 - currentHeight * 0.5);

    //   ->
    if (distanceX > 0 && newOffsetX > minTranslateX) {
      newOffsetX = minTranslateX - 1 + Math.pow(-minTranslateX + currentOffsetX + distanceX, 0.8) || 0;
    }

    //    <-
    if (distanceX < 0 && newOffsetX < maxTranslateX) {
      newOffsetX = maxTranslateX + 1 - Math.pow(maxTranslateX - currentOffsetX - distanceX, 0.8) || 0;
    }

    //   \/
    if (distanceY > 0 && newOffsetY > minTranslateY) {
      newOffsetY = minTranslateY - 1 + Math.pow(-minTranslateY + currentOffsetY + distanceY, 0.8) || 0;
    }

    //   /\
    if (distanceY < 0 && newOffsetY < maxTranslateY) {
      newOffsetY = maxTranslateY + 1 - Math.pow(maxTranslateY - currentOffsetY - distanceY, 0.8) || 0;
    }

    return {
      top: newOffsetY,
      left: newOffsetX
    };
  };

  Guestures.prototype.limitPosition = function(newOffsetX, newOffsetY, newWidth, newHeight) {
    var self = this;

    var canvasWidth = self.canvasWidth;
    var canvasHeight = self.canvasHeight;

    if (newWidth > canvasWidth) {
      newOffsetX = newOffsetX > 0 ? 0 : newOffsetX;
      newOffsetX = newOffsetX < canvasWidth - newWidth ? canvasWidth - newWidth : newOffsetX;
    } else {
      // Center horizontally
      newOffsetX = Math.max(0, canvasWidth / 2 - newWidth / 2);
    }

    if (newHeight > canvasHeight) {
      newOffsetY = newOffsetY > 0 ? 0 : newOffsetY;
      newOffsetY = newOffsetY < canvasHeight - newHeight ? canvasHeight - newHeight : newOffsetY;
    } else {
      // Center vertically
      newOffsetY = Math.max(0, canvasHeight / 2 - newHeight / 2);
    }

    return {
      top: newOffsetY,
      left: newOffsetX
    };
  };

  Guestures.prototype.onZoom = function() {
    var self = this;

    // Calculate current distance between points to get pinch ratio and new width and height
    var contentStartPos = self.contentStartPos;

    var currentWidth = contentStartPos.width;
    var currentHeight = contentStartPos.height;

    var currentOffsetX = contentStartPos.left;
    var currentOffsetY = contentStartPos.top;

    var endDistanceBetweenFingers = distance(self.newPoints[0], self.newPoints[1]);

    var pinchRatio = endDistanceBetweenFingers / self.startDistanceBetweenFingers;

    var newWidth = Math.floor(currentWidth * pinchRatio);
    var newHeight = Math.floor(currentHeight * pinchRatio);

    // This is the translation due to pinch-zooming
    var translateFromZoomingX = (currentWidth - newWidth) * self.percentageOfImageAtPinchPointX;
    var translateFromZoomingY = (currentHeight - newHeight) * self.percentageOfImageAtPinchPointY;

    // Point between the two touches
    var centerPointEndX = (self.newPoints[0].x + self.newPoints[1].x) / 2 - $(window).scrollLeft();
    var centerPointEndY = (self.newPoints[0].y + self.newPoints[1].y) / 2 - $(window).scrollTop();

    // And this is the translation due to translation of the centerpoint
    // between the two fingers
    var translateFromTranslatingX = centerPointEndX - self.centerPointStartX;
    var translateFromTranslatingY = centerPointEndY - self.centerPointStartY;

    // The new offset is the old/current one plus the total translation
    var newOffsetX = currentOffsetX + (translateFromZoomingX + translateFromTranslatingX);
    var newOffsetY = currentOffsetY + (translateFromZoomingY + translateFromTranslatingY);

    var newPos = {
      top: newOffsetY,
      left: newOffsetX,
      scaleX: pinchRatio,
      scaleY: pinchRatio
    };

    self.canTap = false;

    self.newWidth = newWidth;
    self.newHeight = newHeight;

    self.contentLastPos = newPos;

    if (self.requestId) {
      cancelAFrame(self.requestId);

      self.requestId = null;
    }

    self.requestId = requestAFrame(function() {
      $.fancybox.setTranslate(self.$content, self.contentLastPos);
    });
  };

  Guestures.prototype.ontouchend = function(e) {
    var self = this;
    var dMs = Math.max(new Date().getTime() - self.startTime, 1);

    var swiping = self.isSwiping;
    var panning = self.isPanning;
    var zooming = self.isZooming;
    var scrolling = self.isScrolling;

    self.endPoints = getPointerXY(e);

    self.$container.removeClass("fancybox-controls--isGrabbing");

    $(document).off(".fb.touch");

    document.removeEventListener("scroll", self.onscroll, true);

    if (self.requestId) {
      cancelAFrame(self.requestId);

      self.requestId = null;
    }

    self.isSwiping = false;
    self.isPanning = false;
    self.isZooming = false;
    self.isScrolling = false;

    self.instance.isDragging = false;

    if (self.canTap) {
      return self.onTap(e);
    }

    self.speed = 366;

    // Speed in px/ms
    self.velocityX = self.distanceX / dMs * 0.5;
    self.velocityY = self.distanceY / dMs * 0.5;

    self.speedX = Math.max(self.speed * 0.5, Math.min(self.speed * 1.5, 1 / Math.abs(self.velocityX) * self.speed));

    if (panning) {
      self.endPanning();
    } else if (zooming) {
      self.endZooming();
    } else {
      self.endSwiping(swiping, scrolling);
    }

    return;
  };

  Guestures.prototype.endSwiping = function(swiping, scrolling) {
    var self = this,
      ret = false,
      len = self.instance.group.length;

    self.sliderLastPos = null;

    // Close if swiped vertically / navigate if horizontally
    if (swiping == "y" && !scrolling && Math.abs(self.distanceY) > 50) {
      // Continue vertical movement
      $.fancybox.animate(
        self.instance.current.$slide,
        {
          top: self.sliderStartPos.top + self.distanceY + self.velocityY * 150,
          opacity: 0
        },
        200
      );

      ret = self.instance.close(true, 200);
    } else if (swiping == "x" && self.distanceX > 50 && len > 1) {
      ret = self.instance.previous(self.speedX);
    } else if (swiping == "x" && self.distanceX < -50 && len > 1) {
      ret = self.instance.next(self.speedX);
    }

    if (ret === false && (swiping == "x" || swiping == "y")) {
      if (scrolling || len < 2) {
        self.instance.centerSlide(self.instance.current, 150);
      } else {
        self.instance.jumpTo(self.instance.current.index);
      }
    }

    self.$container.removeClass("fancybox-is-sliding");
  };

  // Limit panning from edges
  // ========================
  Guestures.prototype.endPanning = function() {
    var self = this;
    var newOffsetX, newOffsetY, newPos;

    if (!self.contentLastPos) {
      return;
    }

    if (self.opts.momentum === false) {
      newOffsetX = self.contentLastPos.left;
      newOffsetY = self.contentLastPos.top;
    } else {
      // Continue movement
      newOffsetX = self.contentLastPos.left + self.velocityX * self.speed;
      newOffsetY = self.contentLastPos.top + self.velocityY * self.speed;
    }

    newPos = self.limitPosition(newOffsetX, newOffsetY, self.contentStartPos.width, self.contentStartPos.height);

    newPos.width = self.contentStartPos.width;
    newPos.height = self.contentStartPos.height;

    $.fancybox.animate(self.$content, newPos, 330);
  };

  Guestures.prototype.endZooming = function() {
    var self = this;

    var current = self.instance.current;

    var newOffsetX, newOffsetY, newPos, reset;

    var newWidth = self.newWidth;
    var newHeight = self.newHeight;

    if (!self.contentLastPos) {
      return;
    }

    newOffsetX = self.contentLastPos.left;
    newOffsetY = self.contentLastPos.top;

    reset = {
      top: newOffsetY,
      left: newOffsetX,
      width: newWidth,
      height: newHeight,
      scaleX: 1,
      scaleY: 1
    };

    // Reset scalex/scaleY values; this helps for perfomance and does not break animation
    $.fancybox.setTranslate(self.$content, reset);

    if (newWidth < self.canvasWidth && newHeight < self.canvasHeight) {
      self.instance.scaleToFit(150);
    } else if (newWidth > current.width || newHeight > current.height) {
      self.instance.scaleToActual(self.centerPointStartX, self.centerPointStartY, 150);
    } else {
      newPos = self.limitPosition(newOffsetX, newOffsetY, newWidth, newHeight);

      // Switch from scale() to width/height or animation will not work correctly
      $.fancybox.setTranslate(self.$content, $.fancybox.getTranslate(self.$content));

      $.fancybox.animate(self.$content, newPos, 150);
    }
  };

  Guestures.prototype.onTap = function(e) {
    var self = this;
    var $target = $(e.target);

    var instance = self.instance;
    var current = instance.current;

    var endPoints = (e && getPointerXY(e)) || self.startPoints;

    var tapX = endPoints[0] ? endPoints[0].x - $(window).scrollLeft() - self.stagePos.left : 0;
    var tapY = endPoints[0] ? endPoints[0].y - $(window).scrollTop() - self.stagePos.top : 0;

    var where;

    var process = function(prefix) {
      var action = current.opts[prefix];

      if ($.isFunction(action)) {
        action = action.apply(instance, [current, e]);
      }

      if (!action) {
        return;
      }

      switch (action) {
        case "close":
          instance.close(self.startEvent);

          break;

        case "toggleControls":
          instance.toggleControls(true);

          break;

        case "next":
          instance.next();

          break;

        case "nextOrClose":
          if (instance.group.length > 1) {
            instance.next();
          } else {
            instance.close(self.startEvent);
          }

          break;

        case "zoom":
          if (current.type == "image" && (current.isLoaded || current.$ghost)) {
            if (instance.canPan()) {
              instance.scaleToFit();
            } else if (instance.isScaledDown()) {
              instance.scaleToActual(tapX, tapY);
            } else if (instance.group.length < 2) {
              instance.close(self.startEvent);
            }
          }

          break;
      }
    };

    // Ignore right click
    if (e.originalEvent && e.originalEvent.button == 2) {
      return;
    }

    // Skip if clicked on the scrollbar
    if (!$target.is("img") && tapX > $target[0].clientWidth + $target.offset().left) {
      return;
    }

    // Check where is clicked
    if ($target.is(".fancybox-bg,.fancybox-inner,.fancybox-outer,.fancybox-container")) {
      where = "Outside";
    } else if ($target.is(".fancybox-slide")) {
      where = "Slide";
    } else if (
      instance.current.$content &&
      instance.current.$content
        .find($target)
        .addBack()
        .filter($target).length
    ) {
      where = "Content";
    } else {
      return;
    }

    // Check if this is a double tap
    if (self.tapped) {
      // Stop previously created single tap
      clearTimeout(self.tapped);
      self.tapped = null;

      // Skip if distance between taps is too big
      if (Math.abs(tapX - self.tapX) > 50 || Math.abs(tapY - self.tapY) > 50) {
        return this;
      }

      // OK, now we assume that this is a double-tap
      process("dblclick" + where);
    } else {
      // Single tap will be processed if user has not clicked second time within 300ms
      // or there is no need to wait for double-tap
      self.tapX = tapX;
      self.tapY = tapY;

      if (current.opts["dblclick" + where] && current.opts["dblclick" + where] !== current.opts["click" + where]) {
        self.tapped = setTimeout(function() {
          self.tapped = null;

          process("click" + where);
        }, 500);
      } else {
        process("click" + where);
      }
    }

    return this;
  };

  $(document).on("onActivate.fb", function(e, instance) {
    if (instance && !instance.Guestures) {
      instance.Guestures = new Guestures(instance);
    }
  });
})(window, document, window.jQuery || jQuery);

// ==========================================================================
//
// SlideShow
// Enables slideshow functionality
//
// Example of usage:
// $.fancybox.getInstance().SlideShow.start()
//
// ==========================================================================
(function(document, $) {
  "use strict";

  $.extend(true, $.fancybox.defaults, {
    btnTpl: {
      slideShow:
        '<button data-fancybox-play class="fancybox-button fancybox-button--play" title="{{PLAY_START}}">' +
        '<svg viewBox="0 0 40 40">' +
        '<path d="M13,12 L27,20 L13,27 Z" />' +
        '<path d="M15,10 v19 M23,10 v19" />' +
        "</svg>" +
        "</button>"
    },
    slideShow: {
      autoStart: false,
      speed: 3000
    }
  });

  var SlideShow = function(instance) {
    this.instance = instance;
    this.init();
  };

  $.extend(SlideShow.prototype, {
    timer: null,
    isActive: false,
    $button: null,

    init: function() {
      var self = this;

      self.$button = self.instance.$refs.toolbar.find("[data-fancybox-play]").on("click", function() {
        self.toggle();
      });

      if (self.instance.group.length < 2 || !self.instance.group[self.instance.currIndex].opts.slideShow) {
        self.$button.hide();
      }
    },

    set: function(force) {
      var self = this;

      // Check if reached last element
      if (
        self.instance &&
        self.instance.current &&
        (force === true || self.instance.current.opts.loop || self.instance.currIndex < self.instance.group.length - 1)
      ) {
        self.timer = setTimeout(function() {
          if (self.isActive) {
            self.instance.jumpTo((self.instance.currIndex + 1) % self.instance.group.length);
          }
        }, self.instance.current.opts.slideShow.speed);
      } else {
        self.stop();
        self.instance.idleSecondsCounter = 0;
        self.instance.showControls();
      }
    },

    clear: function() {
      var self = this;

      clearTimeout(self.timer);

      self.timer = null;
    },

    start: function() {
      var self = this;
      var current = self.instance.current;

      if (current) {
        self.isActive = true;

        self.$button
          .attr("title", current.opts.i18n[current.opts.lang].PLAY_STOP)
          .removeClass("fancybox-button--play")
          .addClass("fancybox-button--pause");

        self.set(true);
      }
    },

    stop: function() {
      var self = this;
      var current = self.instance.current;

      self.clear();

      self.$button
        .attr("title", current.opts.i18n[current.opts.lang].PLAY_START)
        .removeClass("fancybox-button--pause")
        .addClass("fancybox-button--play");

      self.isActive = false;
    },

    toggle: function() {
      var self = this;

      if (self.isActive) {
        self.stop();
      } else {
        self.start();
      }
    }
  });

  $(document).on({
    "onInit.fb": function(e, instance) {
      if (instance && !instance.SlideShow) {
        instance.SlideShow = new SlideShow(instance);
      }
    },

    "beforeShow.fb": function(e, instance, current, firstRun) {
      var SlideShow = instance && instance.SlideShow;

      if (firstRun) {
        if (SlideShow && current.opts.slideShow.autoStart) {
          SlideShow.start();
        }
      } else if (SlideShow && SlideShow.isActive) {
        SlideShow.clear();
      }
    },

    "afterShow.fb": function(e, instance, current) {
      var SlideShow = instance && instance.SlideShow;

      if (SlideShow && SlideShow.isActive) {
        SlideShow.set();
      }
    },

    "afterKeydown.fb": function(e, instance, current, keypress, keycode) {
      var SlideShow = instance && instance.SlideShow;

      // "P" or Spacebar
      if (SlideShow && current.opts.slideShow && (keycode === 80 || keycode === 32) && !$(document.activeElement).is("button,a,input")) {
        keypress.preventDefault();

        SlideShow.toggle();
      }
    },

    "beforeClose.fb onDeactivate.fb": function(e, instance) {
      var SlideShow = instance && instance.SlideShow;

      if (SlideShow) {
        SlideShow.stop();
      }
    }
  });

  // Page Visibility API to pause slideshow when window is not active
  $(document).on("visibilitychange", function() {
    var instance = $.fancybox.getInstance();
    var SlideShow = instance && instance.SlideShow;

    if (SlideShow && SlideShow.isActive) {
      if (document.hidden) {
        SlideShow.clear();
      } else {
        SlideShow.set();
      }
    }
  });
})(document, window.jQuery || jQuery);

// ==========================================================================
//
// FullScreen
// Adds fullscreen functionality
//
// ==========================================================================
(function(document, $) {
  "use strict";

  // Collection of methods supported by user browser
  var fn = (function() {
    var fnMap = [
      ["requestFullscreen", "exitFullscreen", "fullscreenElement", "fullscreenEnabled", "fullscreenchange", "fullscreenerror"],
      // new WebKit
      [
        "webkitRequestFullscreen",
        "webkitExitFullscreen",
        "webkitFullscreenElement",
        "webkitFullscreenEnabled",
        "webkitfullscreenchange",
        "webkitfullscreenerror"
      ],
      // old WebKit (Safari 5.1)
      [
        "webkitRequestFullScreen",
        "webkitCancelFullScreen",
        "webkitCurrentFullScreenElement",
        "webkitCancelFullScreen",
        "webkitfullscreenchange",
        "webkitfullscreenerror"
      ],
      [
        "mozRequestFullScreen",
        "mozCancelFullScreen",
        "mozFullScreenElement",
        "mozFullScreenEnabled",
        "mozfullscreenchange",
        "mozfullscreenerror"
      ],
      ["msRequestFullscreen", "msExitFullscreen", "msFullscreenElement", "msFullscreenEnabled", "MSFullscreenChange", "MSFullscreenError"]
    ];

    var ret = {};

    for (var i = 0; i < fnMap.length; i++) {
      var val = fnMap[i];

      if (val && val[1] in document) {
        for (var j = 0; j < val.length; j++) {
          ret[fnMap[0][j]] = val[j];
        }

        return ret;
      }
    }

    return false;
  })();

  // If browser does not have Full Screen API, then simply unset default button template and stop
  if (!fn) {
    if ($ && $.fancybox) {
      $.fancybox.defaults.btnTpl.fullScreen = false;
    }

    return;
  }

  var FullScreen = {
    request: function(elem) {
      elem = elem || document.documentElement;

      elem[fn.requestFullscreen](elem.ALLOW_KEYBOARD_INPUT);
    },
    exit: function() {
      document[fn.exitFullscreen]();
    },
    toggle: function(elem) {
      elem = elem || document.documentElement;

      if (this.isFullscreen()) {
        this.exit();
      } else {
        this.request(elem);
      }
    },
    isFullscreen: function() {
      return Boolean(document[fn.fullscreenElement]);
    },
    enabled: function() {
      return Boolean(document[fn.fullscreenEnabled]);
    }
  };

  $.extend(true, $.fancybox.defaults, {
    btnTpl: {
      fullScreen:
        '<button data-fancybox-fullscreen class="fancybox-button fancybox-button--fullscreen" title="{{FULL_SCREEN}}">' +
        '<svg viewBox="0 0 40 40">' +
        '<path d="M9,12 v16 h22 v-16 h-22 v8" />' +
        "</svg>" +
        "</button>"
    },
    fullScreen: {
      autoStart: false
    }
  });

  $(document).on({
    "onInit.fb": function(e, instance) {
      var $container;

      if (instance && instance.group[instance.currIndex].opts.fullScreen) {
        $container = instance.$refs.container;

        $container.on("click.fb-fullscreen", "[data-fancybox-fullscreen]", function(e) {
          e.stopPropagation();
          e.preventDefault();

          FullScreen.toggle();
        });

        if (instance.opts.fullScreen && instance.opts.fullScreen.autoStart === true) {
          FullScreen.request();
        }

        // Expose API
        instance.FullScreen = FullScreen;
      } else if (instance) {
        instance.$refs.toolbar.find("[data-fancybox-fullscreen]").hide();
      }
    },

    "afterKeydown.fb": function(e, instance, current, keypress, keycode) {
      // "F"
      if (instance && instance.FullScreen && keycode === 70) {
        keypress.preventDefault();

        instance.FullScreen.toggle();
      }
    },

    "beforeClose.fb": function(e, instance) {
      if (instance && instance.FullScreen && instance.$refs.container.hasClass("fancybox-is-fullscreen")) {
        FullScreen.exit();
      }
    }
  });

  $(document).on(fn.fullscreenchange, function() {
    var isFullscreen = FullScreen.isFullscreen(),
      instance = $.fancybox.getInstance();

    if (instance) {
      // If image is zooming, then force to stop and reposition properly
      if (instance.current && instance.current.type === "image" && instance.isAnimating) {
        instance.current.$content.css("transition", "none");

        instance.isAnimating = false;

        instance.update(true, true, 0);
      }

      instance.trigger("onFullscreenChange", isFullscreen);

      instance.$refs.container.toggleClass("fancybox-is-fullscreen", isFullscreen);
    }
  });
})(document, window.jQuery || jQuery);

// ==========================================================================
//
// Thumbs
// Displays thumbnails in a grid
//
// ==========================================================================
(function(document, $) {
  "use strict";

  var CLASS = "fancybox-thumbs",
    CLASS_ACTIVE = CLASS + "-active",
    CLASS_LOAD = CLASS + "-loading";

  // Make sure there are default values
  $.fancybox.defaults = $.extend(
    true,
    {
      btnTpl: {
        thumbs:
          '<button data-fancybox-thumbs class="fancybox-button fancybox-button--thumbs" title="{{THUMBS}}">' +
          '<svg viewBox="0 0 120 120">' +
          '<path d="M30,30 h14 v14 h-14 Z M50,30 h14 v14 h-14 Z M70,30 h14 v14 h-14 Z M30,50 h14 v14 h-14 Z M50,50 h14 v14 h-14 Z M70,50 h14 v14 h-14 Z M30,70 h14 v14 h-14 Z M50,70 h14 v14 h-14 Z M70,70 h14 v14 h-14 Z" />' +
          "</svg>" +
          "</button>"
      },
      thumbs: {
        autoStart: false, // Display thumbnails on opening
        hideOnClose: true, // Hide thumbnail grid when closing animation starts
        parentEl: ".fancybox-container", // Container is injected into this element
        axis: "y" // Vertical (y) or horizontal (x) scrolling
      }
    },
    $.fancybox.defaults
  );

  var FancyThumbs = function(instance) {
    this.init(instance);
  };

  $.extend(FancyThumbs.prototype, {
    $button: null,
    $grid: null,
    $list: null,
    isVisible: false,
    isActive: false,

    init: function(instance) {
      var self = this,
        first,
        second;

      self.instance = instance;

      instance.Thumbs = self;

      self.opts = instance.group[instance.currIndex].opts.thumbs;

      // Enable thumbs if at least two group items have thumbnails
      first = instance.group[0];
      first = first.opts.thumb || (first.opts.$thumb && first.opts.$thumb.length ? first.opts.$thumb.attr("src") : false);

      if (instance.group.length > 1) {
        second = instance.group[1];
        second = second.opts.thumb || (second.opts.$thumb && second.opts.$thumb.length ? second.opts.$thumb.attr("src") : false);
      }

      self.$button = instance.$refs.toolbar.find("[data-fancybox-thumbs]");

      if (self.opts && first && second && first && second) {
        self.$button.show().on("click", function() {
          self.toggle();
        });

        self.isActive = true;
      } else {
        self.$button.hide();
      }
    },

    create: function() {
      var self = this,
        instance = self.instance,
        parentEl = self.opts.parentEl,
        list = [],
        src;

      if (!self.$grid) {
        // Create main element
        self.$grid = $('<div class="' + CLASS + " " + CLASS + "-" + self.opts.axis + '"></div>').appendTo(
          instance.$refs.container
            .find(parentEl)
            .addBack()
            .filter(parentEl)
        );

        // Add "click" event that performs gallery navigation
        self.$grid.on("click", "li", function() {
          instance.jumpTo($(this).attr("data-index"));
        });
      }

      // Build the list
      if (!self.$list) {
        self.$list = $("<ul>").appendTo(self.$grid);
      }

      $.each(instance.group, function(i, item) {
        src = item.opts.thumb || (item.opts.$thumb ? item.opts.$thumb.attr("src") : null);

        if (!src && item.type === "image") {
          src = item.src;
        }

        list.push(
          '<li data-index="' +
            i +
            '" tabindex="0" class="' +
            CLASS_LOAD +
            '"' +
            (src && src.length ? ' style="background-image:url(' + src + ')" />' : "") +
            "></li>"
        );
      });

      self.$list[0].innerHTML = list.join("");

      if (self.opts.axis === "x") {
        // Set fixed width for list element to enable horizontal scrolling
        self.$list.width(
          parseInt(self.$grid.css("padding-right"), 10) +
            instance.group.length *
              self.$list
                .children()
                .eq(0)
                .outerWidth(true)
        );
      }
    },

    focus: function(duration) {
      var self = this,
        $list = self.$list,
        $grid = self.$grid,
        thumb,
        thumbPos;

      if (!self.instance.current) {
        return;
      }

      thumb = $list
        .children()
        .removeClass(CLASS_ACTIVE)
        .filter('[data-index="' + self.instance.current.index + '"]')
        .addClass(CLASS_ACTIVE);

      thumbPos = thumb.position();

      // Check if need to scroll to make current thumb visible
      if (self.opts.axis === "y" && (thumbPos.top < 0 || thumbPos.top > $list.height() - thumb.outerHeight())) {
        $list.stop().animate(
          {
            scrollTop: $list.scrollTop() + thumbPos.top
          },
          duration
        );
      } else if (
        self.opts.axis === "x" &&
        (thumbPos.left < $grid.scrollLeft() || thumbPos.left > $grid.scrollLeft() + ($grid.width() - thumb.outerWidth()))
      ) {
        $list
          .parent()
          .stop()
          .animate(
            {
              scrollLeft: thumbPos.left
            },
            duration
          );
      }
    },

    update: function() {
      var that = this;
      that.instance.$refs.container.toggleClass("fancybox-show-thumbs", this.isVisible);

      if (that.isVisible) {
        if (!that.$grid) {
          that.create();
        }

        that.instance.trigger("onThumbsShow");

        that.focus(0);
      } else if (that.$grid) {
        that.instance.trigger("onThumbsHide");
      }

      // Update content position
      that.instance.update();
    },

    hide: function() {
      this.isVisible = false;
      this.update();
    },

    show: function() {
      this.isVisible = true;
      this.update();
    },

    toggle: function() {
      this.isVisible = !this.isVisible;
      this.update();
    }
  });

  $(document).on({
    "onInit.fb": function(e, instance) {
      var Thumbs;

      if (instance && !instance.Thumbs) {
        Thumbs = new FancyThumbs(instance);

        if (Thumbs.isActive && Thumbs.opts.autoStart === true) {
          Thumbs.show();
        }
      }
    },

    "beforeShow.fb": function(e, instance, item, firstRun) {
      var Thumbs = instance && instance.Thumbs;

      if (Thumbs && Thumbs.isVisible) {
        Thumbs.focus(firstRun ? 0 : 250);
      }
    },

    "afterKeydown.fb": function(e, instance, current, keypress, keycode) {
      var Thumbs = instance && instance.Thumbs;

      // "G"
      if (Thumbs && Thumbs.isActive && keycode === 71) {
        keypress.preventDefault();

        Thumbs.toggle();
      }
    },

    "beforeClose.fb": function(e, instance) {
      var Thumbs = instance && instance.Thumbs;

      if (Thumbs && Thumbs.isVisible && Thumbs.opts.hideOnClose !== false) {
        Thumbs.$grid.hide();
      }
    }
  });
})(document, window.jQuery || jQuery);

//// ==========================================================================
//
// Share
// Displays simple form for sharing current url
//
// ==========================================================================
(function(document, $) {
  "use strict";

  $.extend(true, $.fancybox.defaults, {
    btnTpl: {
      share:
        '<button data-fancybox-share class="fancybox-button fancybox-button--share" title="{{SHARE}}">' +
        '<svg viewBox="0 0 40 40">' +
        '<path d="M6,30 C8,18 19,16 23,16 L23,16 L23,10 L33,20 L23,29 L23,24 C19,24 8,27 6,30 Z">' +
        "</svg>" +
        "</button>"
    },
    share: {
      url: function(instance, item) {
        return (
          (!instance.currentHash && !(item.type === "inline" || item.type === "html") ? item.origSrc || item.src : false) || window.location
        );
      },
      tpl:
        '<div class="fancybox-share">' +
        "<h1>{{SHARE}}</h1>" +
        "<p>" +
        '<a class="fancybox-share__button fancybox-share__button--fb" href="https://www.facebook.com/sharer/sharer.php?u={{url}}">' +
        '<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="m287 456v-299c0-21 6-35 35-35h38v-63c-7-1-29-3-55-3-54 0-91 33-91 94v306m143-254h-205v72h196" /></svg>' +
        "<span>Facebook</span>" +
        "</a>" +
        '<a class="fancybox-share__button fancybox-share__button--tw" href="https://twitter.com/intent/tweet?url={{url}}&text={{descr}}">' +
        '<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="m456 133c-14 7-31 11-47 13 17-10 30-27 37-46-15 10-34 16-52 20-61-62-157-7-141 75-68-3-129-35-169-85-22 37-11 86 26 109-13 0-26-4-37-9 0 39 28 72 65 80-12 3-25 4-37 2 10 33 41 57 77 57-42 30-77 38-122 34 170 111 378-32 359-208 16-11 30-25 41-42z" /></svg>' +
        "<span>Twitter</span>" +
        "</a>" +
        '<a class="fancybox-share__button fancybox-share__button--pt" href="https://www.pinterest.com/pin/create/button/?url={{url}}&description={{descr}}&media={{media}}">' +
        '<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="m265 56c-109 0-164 78-164 144 0 39 15 74 47 87 5 2 10 0 12-5l4-19c2-6 1-8-3-13-9-11-15-25-15-45 0-58 43-110 113-110 62 0 96 38 96 88 0 67-30 122-73 122-24 0-42-19-36-44 6-29 20-60 20-81 0-19-10-35-31-35-25 0-44 26-44 60 0 21 7 36 7 36l-30 125c-8 37-1 83 0 87 0 3 4 4 5 2 2-3 32-39 42-75l16-64c8 16 31 29 56 29 74 0 124-67 124-157 0-69-58-132-146-132z" fill="#fff"/></svg>' +
        "<span>Pinterest</span>" +
        "</a>" +
        "</p>" +
        '<p><input class="fancybox-share__input" type="text" value="{{url_raw}}" /></p>' +
        "</div>"
    }
  });

  function escapeHtml(string) {
    var entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
      "/": "&#x2F;",
      "`": "&#x60;",
      "=": "&#x3D;"
    };

    return String(string).replace(/[&<>"'`=\/]/g, function(s) {
      return entityMap[s];
    });
  }

  $(document).on("click", "[data-fancybox-share]", function() {
    var instance = $.fancybox.getInstance(),
      current = instance.current || null,
      url,
      tpl;

    if (!current) {
      return;
    }

    if ($.type(current.opts.share.url) === "function") {
      url = current.opts.share.url.apply(current, [instance, current]);
    }

    tpl = current.opts.share.tpl
      .replace(/\{\{media\}\}/g, current.type === "image" ? encodeURIComponent(current.src) : "")
      .replace(/\{\{url\}\}/g, encodeURIComponent(url))
      .replace(/\{\{url_raw\}\}/g, escapeHtml(url))
      .replace(/\{\{descr\}\}/g, instance.$caption ? encodeURIComponent(instance.$caption.text()) : "");

    $.fancybox.open({
      src: instance.translate(instance, tpl),
      type: "html",
      opts: {
        animationEffect: false,
        afterLoad: function(shareInstance, shareCurrent) {
          // Close self if parent instance is closing
          instance.$refs.container.one("beforeClose.fb", function() {
            shareInstance.close(null, 0);
          });

          // Opening links in a popup window
          shareCurrent.$content.find(".fancybox-share__links a").click(function() {
            window.open(this.href, "Share", "width=550, height=450");
            return false;
          });
        }
      }
    });
  });
})(document, window.jQuery || jQuery);

// ==========================================================================
//
// Hash
// Enables linking to each modal
//
// ==========================================================================
(function(document, window, $) {
  "use strict";

  // Simple $.escapeSelector polyfill (for jQuery prior v3)
  if (!$.escapeSelector) {
    $.escapeSelector = function(sel) {
      var rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g;
      var fcssescape = function(ch, asCodePoint) {
        if (asCodePoint) {
          // U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
          if (ch === "\0") {
            return "\uFFFD";
          }

          // Control characters and (dependent upon position) numbers get escaped as code points
          return ch.slice(0, -1) + "\\" + ch.charCodeAt(ch.length - 1).toString(16) + " ";
        }

        // Other potentially-special ASCII characters get backslash-escaped
        return "\\" + ch;
      };

      return (sel + "").replace(rcssescape, fcssescape);
    };
  }

  // Get info about gallery name and current index from url
  function parseUrl() {
    var hash = window.location.hash.substr(1),
      rez = hash.split("-"),
      index = rez.length > 1 && /^\+?\d+$/.test(rez[rez.length - 1]) ? parseInt(rez.pop(-1), 10) || 1 : 1,
      gallery = rez.join("-");

    return {
      hash: hash,
      /* Index is starting from 1 */
      index: index < 1 ? 1 : index,
      gallery: gallery
    };
  }

  // Trigger click evnt on links to open new fancyBox instance
  function triggerFromUrl(url) {
    var $el;

    if (url.gallery !== "") {
      // If we can find element matching 'data-fancybox' atribute, then trigger click event for that.
      // It should start fancyBox
      $el = $("[data-fancybox='" + $.escapeSelector(url.gallery) + "']")
        .eq(url.index - 1)
        .trigger("click.fb-start");
    }
  }

  // Get gallery name from current instance
  function getGalleryID(instance) {
    var opts, ret;

    if (!instance) {
      return false;
    }

    opts = instance.current ? instance.current.opts : instance.opts;
    ret = opts.hash || (opts.$orig ? opts.$orig.data("fancybox") : "");

    return ret === "" ? false : ret;
  }

  // Start when DOM becomes ready
  $(function() {
    // Check if user has disabled this module
    if ($.fancybox.defaults.hash === false) {
      return;
    }

    // Update hash when opening/closing fancyBox
    $(document).on({
      "onInit.fb": function(e, instance) {
        var url, gallery;

        if (instance.group[instance.currIndex].opts.hash === false) {
          return;
        }

        url = parseUrl();
        gallery = getGalleryID(instance);

        // Make sure gallery start index matches index from hash
        if (gallery && url.gallery && gallery == url.gallery) {
          instance.currIndex = url.index - 1;
        }
      },

      "beforeShow.fb": function(e, instance, current, firstRun) {
        var gallery;

        if (!current || current.opts.hash === false) {
          return;
        }

        // Check if need to update window hash
        gallery = getGalleryID(instance);

        if (!gallery) {
          return;
        }

        // Variable containing last hash value set by fancyBox
        // It will be used to determine if fancyBox needs to close after hash change is detected
        instance.currentHash = gallery + (instance.group.length > 1 ? "-" + (current.index + 1) : "");

        // If current hash is the same (this instance most likely is opened by hashchange), then do nothing
        if (window.location.hash === "#" + instance.currentHash) {
          return;
        }

        if (!instance.origHash) {
          instance.origHash = window.location.hash;
        }

        if (instance.hashTimer) {
          clearTimeout(instance.hashTimer);
        }

        // Update hash
        instance.hashTimer = setTimeout(function() {
          if ("replaceState" in window.history) {
            window.history[firstRun ? "pushState" : "replaceState"](
              {},
              document.title,
              window.location.pathname + window.location.search + "#" + instance.currentHash
            );

            if (firstRun) {
              instance.hasCreatedHistory = true;
            }
          } else {
            window.location.hash = instance.currentHash;
          }

          instance.hashTimer = null;
        }, 300);
      },

      "beforeClose.fb": function(e, instance, current) {
        var gallery;

        if (current.opts.hash === false) {
          return;
        }

        gallery = getGalleryID(instance);

        // Goto previous history entry
        if (instance.currentHash && instance.hasCreatedHistory) {
          window.history.back();
        } else if (instance.currentHash) {
          if ("replaceState" in window.history) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search + (instance.origHash || ""));
          } else {
            window.location.hash = instance.origHash;
          }
        }

        instance.currentHash = null;

        clearTimeout(instance.hashTimer);
      }
    });

    // Check if need to start/close after url has changed
    $(window).on("hashchange.fb", function() {
      var url = parseUrl(),
        fb;

      // Find last fancyBox instance that has "hash"
      $.each(
        $(".fancybox-container")
          .get()
          .reverse(),
        function(index, value) {
          var tmp = $(value).data("FancyBox");
          //isClosing
          if (tmp.currentHash) {
            fb = tmp;
            return false;
          }
        }
      );

      if (fb) {
        // Now, compare hash values
        if (fb.currentHash && fb.currentHash !== url.gallery + "-" + url.index && !(url.index === 1 && fb.currentHash == url.gallery)) {
          fb.currentHash = null;

          fb.close();
        }
      } else if (url.gallery !== "") {
        triggerFromUrl(url);
      }
    });

    // Check current hash and trigger click event on matching element to start fancyBox, if needed
    setTimeout(function() {
      if (!$.fancybox.getInstance()) {
        triggerFromUrl(parseUrl());
      }
    }, 50);
  });
})(document, window, window.jQuery || jQuery);

// ==========================================================================
//
// Wheel
// Basic mouse weheel support for gallery navigation
//
// ==========================================================================
(function(document, $) {
  "use strict";

  var prevTime = new Date().getTime();

  $(document).on({
    "onInit.fb": function(e, instance, current) {
      instance.$refs.stage.on("mousewheel DOMMouseScroll wheel MozMousePixelScroll", function(e) {
        var current = instance.current,
          currTime = new Date().getTime();

        if (instance.group.length < 2 || current.opts.wheel === false || (current.opts.wheel === "auto" && current.type !== "image")) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (current.$slide.hasClass("fancybox-animated")) {
          return;
        }

        e = e.originalEvent || e;

        if (currTime - prevTime < 250) {
          return;
        }

        prevTime = currTime;

        instance[(-e.deltaY || -e.deltaX || e.wheelDelta || -e.detail) < 0 ? "next" : "previous"]();
      });
    }
  });
})(document, window.jQuery || jQuery);

;/*!
 * jQuery & Zepto Lazy - v1.7.9
 * http://jquery.eisbehr.de/lazy/
 *
 * Copyright 2012 - 2018, Daniel 'Eisbehr' Kern
 *
 * Dual licensed under the MIT and GPL-2.0 licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl-2.0.html
 *
 * $("img.lazy").lazy();
 */

;(function(window, undefined) {
    "use strict";

    // noinspection JSUnresolvedVariable
    /**
     * library instance - here and not in construct to be shorter in minimization
     * @return void
     */
    var $ = window.jQuery || window.Zepto,

    /**
     * unique plugin instance id counter
     * @type {number}
     */
    lazyInstanceId = 0,

    /**
     * helper to register window load for jQuery 3
     * @type {boolean}
     */    
    windowLoaded = false;

    /**
     * make lazy available to jquery - and make it a bit more case-insensitive :)
     * @access public
     * @type {function}
     * @param {object} settings
     * @return {LazyPlugin}
     */
    $.fn.Lazy = $.fn.lazy = function(settings) {
        return new LazyPlugin(this, settings);
    };

    /**
     * helper to add plugins to lazy prototype configuration
     * @access public
     * @type {function}
     * @param {string|Array} names
     * @param {string|Array|function} [elements]
     * @param {function} loader
     * @return void
     */
    $.Lazy = $.lazy = function(names, elements, loader) {
        // make second parameter optional
        if ($.isFunction(elements)) {
            loader = elements;
            elements = [];
        }

        // exit here if parameter is not a callable function
        if (!$.isFunction(loader)) {
            return;
        }

        // make parameters an array of names to be sure
        names = $.isArray(names) ? names : [names];
        elements = $.isArray(elements) ? elements : [elements];

        var config = LazyPlugin.prototype.config,
            forced = config._f || (config._f = {});

        // add the loader plugin for every name
        for (var i = 0, l = names.length; i < l; i++) {
            if (config[names[i]] === undefined || $.isFunction(config[names[i]])) {
                config[names[i]] = loader;
            }
        }

        // add forced elements loader
        for (var c = 0, a = elements.length; c < a; c++) {
            forced[elements[c]] = names[0];
        }
    };

    /**
     * contains all logic and the whole element handling
     * is packed in a private function outside class to reduce memory usage, because it will not be created on every plugin instance
     * @access private
     * @type {function}
     * @param {LazyPlugin} instance
     * @param {object} config
     * @param {object|Array} items
     * @param {object} events
     * @param {string} namespace
     * @return void
     */
    function _executeLazy(instance, config, items, events, namespace) {
        /**
         * a helper to trigger the 'onFinishedAll' callback after all other events
         * @access private
         * @type {number}
         */
        var _awaitingAfterLoad = 0,

        /**
         * visible content width
         * @access private
         * @type {number}
         */
        _actualWidth = -1,

        /**
         * visible content height
         * @access private
         * @type {number}
         */
        _actualHeight = -1,

        /**
         * determine possibly detected high pixel density
         * @access private
         * @type {boolean}
         */
        _isRetinaDisplay = false, 

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _afterLoad = 'afterLoad',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _load = 'load',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _error = 'error',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _img = 'img',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _src = 'src',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _srcset = 'srcset',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _sizes = 'sizes',

        /**
         * dictionary entry for better minimization
         * @access private
         * @type {string}
         */
        _backgroundImage = 'background-image';

        /**
         * initialize plugin
         * bind loading to events or set delay time to load all items at once
         * @access private
         * @return void
         */
        function _initialize() {
            // detect actual device pixel ratio
            // noinspection JSUnresolvedVariable
            _isRetinaDisplay = window.devicePixelRatio > 1;

            // prepare all initial items
            items = _prepareItems(items);

            // if delay time is set load all items at once after delay time
            if (config.delay >= 0) {
                setTimeout(function() {
                    _lazyLoadItems(true);
                }, config.delay);
            }

            // if no delay is set or combine usage is active bind events
            if (config.delay < 0 || config.combined) {
                // create unique event function
                events.e = _throttle(config.throttle, function(event) {
                    // reset detected window size on resize event
                    if (event.type === 'resize') {
                        _actualWidth = _actualHeight = -1;
                    }

                    // execute 'lazy magic'
                    _lazyLoadItems(event.all);
                });

                // create function to add new items to instance
                events.a = function(additionalItems) {
                    additionalItems = _prepareItems(additionalItems);
                    items.push.apply(items, additionalItems);
                };

                // create function to get all instance items left
                events.g = function() {
                    // filter loaded items before return in case internal filter was not running until now
                    return (items = $(items).filter(function() {
                        return !$(this).data(config.loadedName);
                    }));
                };

                // create function to force loading elements
                events.f = function(forcedItems) {
                    for (var i = 0; i < forcedItems.length; i++) {
                        // only handle item if available in current instance
                        // use a compare function, because Zepto can't handle object parameter for filter
                        // var item = items.filter(forcedItems[i]);
                        /* jshint loopfunc: true */
                        var item = items.filter(function() {
                            return this === forcedItems[i];
                        });

                        if (item.length) {
                            _lazyLoadItems(false, item);   
                        }
                    }
                };

                // load initial items
                _lazyLoadItems();

                // bind lazy load functions to scroll and resize event
                // noinspection JSUnresolvedVariable
                $(config.appendScroll).on('scroll.' + namespace + ' resize.' + namespace, events.e);
            }
        }

        /**
         * prepare items before handle them
         * @access private
         * @param {Array|object|jQuery} items
         * @return {Array|object|jQuery}
         */
        function _prepareItems(items) {
            // fetch used configurations before loops
            var defaultImage = config.defaultImage,
                placeholder = config.placeholder,
                imageBase = config.imageBase,
                srcsetAttribute = config.srcsetAttribute,
                loaderAttribute = config.loaderAttribute,
                forcedTags = config._f || {};

            // filter items and only add those who not handled yet and got needed attributes available
            items = $(items).filter(function() {
                var element = $(this),
                    tag = _getElementTagName(this);

                return !element.data(config.handledName) && 
                       (element.attr(config.attribute) || element.attr(srcsetAttribute) || element.attr(loaderAttribute) || forcedTags[tag] !== undefined);
            })

            // append plugin instance to all elements
            .data('plugin_' + config.name, instance);

            for (var i = 0, l = items.length; i < l; i++) {
                var element = $(items[i]),
                    tag = _getElementTagName(items[i]),
                    elementImageBase = element.attr(config.imageBaseAttribute) || imageBase;

                // generate and update source set if an image base is set
                if (tag === _img && elementImageBase && element.attr(srcsetAttribute)) {
                    element.attr(srcsetAttribute, _getCorrectedSrcSet(element.attr(srcsetAttribute), elementImageBase));
                }

                // add loader to forced element types
                if (forcedTags[tag] !== undefined && !element.attr(loaderAttribute)) {
                    element.attr(loaderAttribute, forcedTags[tag]);
                }

                // set default image on every element without source
                if (tag === _img && defaultImage && !element.attr(_src)) {
                    element.attr(_src, defaultImage);
                }

                // set placeholder on every element without background image
                else if (tag !== _img && placeholder && (!element.css(_backgroundImage) || element.css(_backgroundImage) === 'none')) {
                    element.css(_backgroundImage, "url('" + placeholder + "')");
                }
            }

            return items;
        }

        /**
         * the 'lazy magic' - check all items
         * @access private
         * @param {boolean} [allItems]
         * @param {object} [forced]
         * @return void
         */
        function _lazyLoadItems(allItems, forced) {
            // skip if no items where left
            if (!items.length) {
                // destroy instance if option is enabled
                if (config.autoDestroy) {
                    // noinspection JSUnresolvedFunction
                    instance.destroy();
                }

                return;
            }

            var elements = forced || items,
                loadTriggered = false,
                imageBase = config.imageBase || '',
                srcsetAttribute = config.srcsetAttribute,
                handledName = config.handledName;

            // loop all available items
            for (var i = 0; i < elements.length; i++) {
                // item is at least in loadable area
                if (allItems || forced || _isInLoadableArea(elements[i])) {
                    var element = $(elements[i]),
                        tag = _getElementTagName(elements[i]),
                        attribute = element.attr(config.attribute),
                        elementImageBase = element.attr(config.imageBaseAttribute) || imageBase,
                        customLoader = element.attr(config.loaderAttribute);

                        // is not already handled 
                    if (!element.data(handledName) &&
                        // and is visible or visibility doesn't matter
                        (!config.visibleOnly || element.is(':visible')) && (
                        // and image source or source set attribute is available
                        (attribute || element.attr(srcsetAttribute)) && (
                            // and is image tag where attribute is not equal source or source set
                            (tag === _img && (elementImageBase + attribute !== element.attr(_src) || element.attr(srcsetAttribute) !== element.attr(_srcset))) ||
                            // or is non image tag where attribute is not equal background
                            (tag !== _img && elementImageBase + attribute !== element.css(_backgroundImage))
                        ) ||
                        // or custom loader is available
                        customLoader))
                    {
                        // mark element always as handled as this point to prevent double handling
                        loadTriggered = true;
                        element.data(handledName, true);

                        // load item
                        _handleItem(element, tag, elementImageBase, customLoader);
                    }
                }
            }

            // when something was loaded remove them from remaining items
            if (loadTriggered) {
                items = $(items).filter(function() {
                    return !$(this).data(handledName);
                });
            }
        }

        /**
         * load the given element the lazy way
         * @access private
         * @param {object} element
         * @param {string} tag
         * @param {string} imageBase
         * @param {function} [customLoader]
         * @return void
         */
        function _handleItem(element, tag, imageBase, customLoader) {
            // increment count of items waiting for after load
            ++_awaitingAfterLoad;

            // extended error callback for correct 'onFinishedAll' handling
            var errorCallback = function() {
                _triggerCallback('onError', element);
                _reduceAwaiting();

                // prevent further callback calls
                errorCallback = $.noop;
            };

            // trigger function before loading image
            _triggerCallback('beforeLoad', element);

            // fetch all double used data here for better code minimization
            var srcAttribute = config.attribute,
                srcsetAttribute = config.srcsetAttribute,
                sizesAttribute = config.sizesAttribute,
                retinaAttribute = config.retinaAttribute,
                removeAttribute = config.removeAttribute,
                loadedName = config.loadedName,
                elementRetina = element.attr(retinaAttribute);

            // handle custom loader
            if (customLoader) {
                // on load callback
                var loadCallback = function() {
                    // remove attribute from element
                    if (removeAttribute) {
                        element.removeAttr(config.loaderAttribute);
                    }

                    // mark element as loaded
                    element.data(loadedName, true);

                    // call after load event
                    _triggerCallback(_afterLoad, element);

                    // remove item from waiting queue and possibly trigger finished event
                    // it's needed to be asynchronous to run after filter was in _lazyLoadItems
                    setTimeout(_reduceAwaiting, 1);

                    // prevent further callback calls
                    loadCallback = $.noop;
                };

                // bind error event to trigger callback and reduce waiting amount
                element.off(_error).one(_error, errorCallback)

                // bind after load callback to element
                .one(_load, loadCallback);

                // trigger custom loader and handle response
                if (!_triggerCallback(customLoader, element, function(response) {
                    if(response) {
                        element.off(_load);
                        loadCallback();
                    }
                    else {
                        element.off(_error);
                        errorCallback();
                    }
                })) {
                    element.trigger(_error);
                }
            }

            // handle images
            else {
                // create image object
                var imageObj = $(new Image());

                // bind error event to trigger callback and reduce waiting amount
                imageObj.one(_error, errorCallback)

                // bind after load callback to image
                .one(_load, function() {
                    // remove element from view
                    element.hide();

                    // set image back to element
                    // do it as single 'attr' calls, to be sure 'src' is set after 'srcset'
                    if (tag === _img) {
                        element.attr(_sizes, imageObj.attr(_sizes))
                               .attr(_srcset, imageObj.attr(_srcset))
                               .attr(_src, imageObj.attr(_src));
                    }
                    else {
                        element.css(_backgroundImage, "url('" + imageObj.attr(_src) + "')");
                    }

                    // bring it back with some effect!
                    element[config.effect](config.effectTime);

                    // remove attribute from element
                    if (removeAttribute) {
                        element.removeAttr(srcAttribute + ' ' + srcsetAttribute + ' ' + retinaAttribute + ' ' + config.imageBaseAttribute);

                        // only remove 'sizes' attribute, if it was a custom one
                        if (sizesAttribute !== _sizes) {
                            element.removeAttr(sizesAttribute);
                        }
                    }

                    // mark element as loaded
                    element.data(loadedName, true);

                    // call after load event
                    _triggerCallback(_afterLoad, element);

                    // cleanup image object
                    imageObj.remove();

                    // remove item from waiting queue and possibly trigger finished event
                    _reduceAwaiting();
                });

                // set sources
                // do it as single 'attr' calls, to be sure 'src' is set after 'srcset'
                var imageSrc = (_isRetinaDisplay && elementRetina ? elementRetina : element.attr(srcAttribute)) || '';
                imageObj.attr(_sizes, element.attr(sizesAttribute))
                        .attr(_srcset, element.attr(srcsetAttribute))
                        .attr(_src, imageSrc ? imageBase + imageSrc : null);

                // call after load even on cached image
                imageObj.complete && imageObj.trigger(_load); // jshint ignore : line
            }
        }

        /**
         * check if the given element is inside the current viewport or threshold
         * @access private
         * @param {object} element
         * @return {boolean}
         */
        function _isInLoadableArea(element) {
            var elementBound = element.getBoundingClientRect(),
                direction    = config.scrollDirection,
                threshold    = config.threshold,
                vertical     = // check if element is in loadable area from top
                               ((_getActualHeight() + threshold) > elementBound.top) &&
                               // check if element is even in loadable are from bottom
                               (-threshold < elementBound.bottom),
                horizontal   = // check if element is in loadable area from left
                               ((_getActualWidth() + threshold) > elementBound.left) &&
                               // check if element is even in loadable area from right
                               (-threshold < elementBound.right);

            if (direction === 'vertical') {
                return vertical;
            }
            else if (direction === 'horizontal') {
                return horizontal;
            }

            return vertical && horizontal;
        }

        /**
         * receive the current viewed width of the browser
         * @access private
         * @return {number}
         */
        function _getActualWidth() {
            return _actualWidth >= 0 ? _actualWidth : (_actualWidth = $(window).width());
        }

        /**
         * receive the current viewed height of the browser
         * @access private
         * @return {number}
         */
        function _getActualHeight() {
            return _actualHeight >= 0 ? _actualHeight : (_actualHeight = $(window).height());
        }

        /**
         * get lowercase tag name of an element
         * @access private
         * @param {object} element
         * @returns {string}
         */
        function _getElementTagName(element) {
            return element.tagName.toLowerCase();
        }

        /**
         * prepend image base to all srcset entries
         * @access private
         * @param {string} srcset
         * @param {string} imageBase
         * @returns {string}
         */
        function _getCorrectedSrcSet(srcset, imageBase) {
            if (imageBase) {
                // trim, remove unnecessary spaces and split entries
                var entries = srcset.split(',');
                srcset = '';

                for (var i = 0, l = entries.length; i < l; i++) {
                    srcset += imageBase + entries[i].trim() + (i !== l - 1 ? ',' : '');
                }
            }

            return srcset;
        }

        /**
         * helper function to throttle down event triggering
         * @access private
         * @param {number} delay
         * @param {function} callback
         * @return {function}
         */
        function _throttle(delay, callback) {
            var timeout,
                lastExecute = 0;

            return function(event, ignoreThrottle) {
                var elapsed = +new Date() - lastExecute;

                function run() {
                    lastExecute = +new Date();
                    // noinspection JSUnresolvedFunction
                    callback.call(instance, event);
                }

                timeout && clearTimeout(timeout); // jshint ignore : line

                if (elapsed > delay || !config.enableThrottle || ignoreThrottle) {
                    run();
                }
                else {
                    timeout = setTimeout(run, delay - elapsed);
                }
            };
        }

        /**
         * reduce count of awaiting elements to 'afterLoad' event and fire 'onFinishedAll' if reached zero
         * @access private
         * @return void
         */
        function _reduceAwaiting() {
            --_awaitingAfterLoad;

            // if no items were left trigger finished event
            if (!items.length && !_awaitingAfterLoad) {
                _triggerCallback('onFinishedAll');
            }
        }

        /**
         * single implementation to handle callbacks, pass element and set 'this' to current instance
         * @access private
         * @param {string|function} callback
         * @param {object} [element]
         * @param {*} [args]
         * @return {boolean}
         */
        function _triggerCallback(callback, element, args) {
            if ((callback = config[callback])) {
                // jQuery's internal '$(arguments).slice(1)' are causing problems at least on old iPads
                // below is shorthand of 'Array.prototype.slice.call(arguments, 1)'
                callback.apply(instance, [].slice.call(arguments, 1));
                return true;
            }

            return false;
        }

        // if event driven or window is already loaded don't wait for page loading
        if (config.bind === 'event' || windowLoaded) {
            _initialize();
        }

        // otherwise load initial items and start lazy after page load
        else {
            // noinspection JSUnresolvedVariable
            $(window).on(_load + '.' + namespace, _initialize);
        }  
    }

    /**
     * lazy plugin class constructor
     * @constructor
     * @access private
     * @param {object} elements
     * @param {object} settings
     * @return {object|LazyPlugin}
     */
    function LazyPlugin(elements, settings) {
        /**
         * this lazy plugin instance
         * @access private
         * @type {object|LazyPlugin|LazyPlugin.prototype}
         */
        var _instance = this,

        /**
         * this lazy plugin instance configuration
         * @access private
         * @type {object}
         */
        _config = $.extend({}, _instance.config, settings),

        /**
         * instance generated event executed on container scroll or resize
         * packed in an object to be referenceable and short named because properties will not be minified
         * @access private
         * @type {object}
         */
        _events = {},

        /**
         * unique namespace for instance related events
         * @access private
         * @type {string}
         */
        _namespace = _config.name + '-' + (++lazyInstanceId);

        // noinspection JSUndefinedPropertyAssignment
        /**
         * wrapper to get or set an entry from plugin instance configuration
         * much smaller on minify as direct access
         * @access public
         * @type {function}
         * @param {string} entryName
         * @param {*} [value]
         * @return {LazyPlugin|*}
         */
        _instance.config = function(entryName, value) {
            if (value === undefined) {
                return _config[entryName];
            }

            _config[entryName] = value;
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * add additional items to current instance
         * @access public
         * @param {Array|object|string} items
         * @return {LazyPlugin}
         */
        _instance.addItems = function(items) {
            _events.a && _events.a($.type(items) === 'string' ? $(items) : items); // jshint ignore : line
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * get all left items of this instance
         * @access public
         * @returns {object}
         */
        _instance.getItems = function() {
            return _events.g ? _events.g() : {};
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * force lazy to load all items in loadable area right now
         * by default without throttle
         * @access public
         * @type {function}
         * @param {boolean} [useThrottle]
         * @return {LazyPlugin}
         */
        _instance.update = function(useThrottle) {
            _events.e && _events.e({}, !useThrottle); // jshint ignore : line
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * force element(s) to load directly, ignoring the viewport
         * @access public
         * @param {Array|object|string} items
         * @return {LazyPlugin}
         */
        _instance.force = function(items) {
            _events.f && _events.f($.type(items) === 'string' ? $(items) : items); // jshint ignore : line
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * force lazy to load all available items right now
         * this call ignores throttling
         * @access public
         * @type {function}
         * @return {LazyPlugin}
         */
        _instance.loadAll = function() {
            _events.e && _events.e({all: true}, true); // jshint ignore : line
            return _instance;
        };

        // noinspection JSUndefinedPropertyAssignment
        /**
         * destroy this plugin instance
         * @access public
         * @type {function}
         * @return undefined
         */
        _instance.destroy = function() {
            // unbind instance generated events
            // noinspection JSUnresolvedFunction, JSUnresolvedVariable
            $(_config.appendScroll).off('.' + _namespace, _events.e);
            // noinspection JSUnresolvedVariable
            $(window).off('.' + _namespace);

            // clear events
            _events = {};

            return undefined;
        };

        // start using lazy and return all elements to be chainable or instance for further use
        // noinspection JSUnresolvedVariable
        _executeLazy(_instance, _config, elements, _events, _namespace);
        return _config.chainable ? elements : _instance;
    }

    /**
     * settings and configuration data
     * @access public
     * @type {object|*}
     */
    LazyPlugin.prototype.config = {
        // general
        name               : 'lazy',
        chainable          : true,
        autoDestroy        : true,
        bind               : 'load',
        threshold          : 500,
        visibleOnly        : false,
        appendScroll       : window,
        scrollDirection    : 'both',
        imageBase          : null,
        defaultImage       : 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
        placeholder        : null,
        delay              : -1,
        combined           : false,

        // attributes
        attribute          : 'data-src',
        srcsetAttribute    : 'data-srcset',
        sizesAttribute     : 'data-sizes',
        retinaAttribute    : 'data-retina',
        loaderAttribute    : 'data-loader',
        imageBaseAttribute : 'data-imagebase',
        removeAttribute    : true,
        handledName        : 'handled',
        loadedName         : 'loaded',

        // effect
        effect             : 'show',
        effectTime         : 0,

        // throttle
        enableThrottle     : true,
        throttle           : 250,

        // callbacks
        beforeLoad         : undefined,
        afterLoad          : undefined,
        onError            : undefined,
        onFinishedAll      : undefined
    };

    // register window load event globally to prevent not loading elements
    // since jQuery 3.X ready state is fully async and may be executed after 'load' 
    $(window).on('load', function() {
        windowLoaded = true;
    });
})(window);
;/*
 * jQuery Easing Compatibility v1 - http://gsgd.co.uk/sandbox/jquery.easing.php
 *
 * Adds compatibility for applications that use the pre 1.2 easing names
 *
 * Copyright (c) 2007 George Smith
 * Licensed under the MIT License:
 *   http://www.opensource.org/licenses/mit-license.php
 */

jQuery.extend( jQuery.easing,
{
	easeIn: function (x, t, b, c, d) {
		return jQuery.easing.easeInQuad(x, t, b, c, d);
	},
	easeOut: function (x, t, b, c, d) {
		return jQuery.easing.easeOutQuad(x, t, b, c, d);
	},
	easeInOut: function (x, t, b, c, d) {
		return jQuery.easing.easeInOutQuad(x, t, b, c, d);
	},
	expoin: function(x, t, b, c, d) {
		return jQuery.easing.easeInExpo(x, t, b, c, d);
	},
	expoout: function(x, t, b, c, d) {
		return jQuery.easing.easeOutExpo(x, t, b, c, d);
	},
	expoinout: function(x, t, b, c, d) {
		return jQuery.easing.easeInOutExpo(x, t, b, c, d);
	},
	bouncein: function(x, t, b, c, d) {
		return jQuery.easing.easeInBounce(x, t, b, c, d);
	},
	bounceout: function(x, t, b, c, d) {
		return jQuery.easing.easeOutBounce(x, t, b, c, d);
	},
	bounceinout: function(x, t, b, c, d) {
		return jQuery.easing.easeInOutBounce(x, t, b, c, d);
	},
	elasin: function(x, t, b, c, d) {
		return jQuery.easing.easeInElastic(x, t, b, c, d);
	},
	elasout: function(x, t, b, c, d) {
		return jQuery.easing.easeOutElastic(x, t, b, c, d);
	},
	elasinout: function(x, t, b, c, d) {
		return jQuery.easing.easeInOutElastic(x, t, b, c, d);
	},
	backin: function(x, t, b, c, d) {
		return jQuery.easing.easeInBack(x, t, b, c, d);
	},
	backout: function(x, t, b, c, d) {
		return jQuery.easing.easeOutBack(x, t, b, c, d);
	},
	backinout: function(x, t, b, c, d) {
		return jQuery.easing.easeInOutBack(x, t, b, c, d);
	}
});
;/*
 * jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/
 *
 * Uses the built in easing capabilities added In jQuery 1.1
 * to offer multiple easing options
 *
 * TERMS OF USE - jQuery Easing
 * 
 * Open source under the BSD License. 
 * 
 * Copyright © 2008 George McGinley Smith
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, 
 * are permitted provided that the following conditions are met:
 * 
 * Redistributions of source code must retain the above copyright notice, this list of 
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list 
 * of conditions and the following disclaimer in the documentation and/or other materials 
 * provided with the distribution.
 * 
 * Neither the name of the author nor the names of contributors may be used to endorse 
 * or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY 
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED 
 * OF THE POSSIBILITY OF SUCH DAMAGE. 
 *
*/

// t: current time, b: begInnIng value, c: change In value, d: duration
jQuery.easing['jswing'] = jQuery.easing['swing'];

jQuery.extend( jQuery.easing,
{
	def: 'easeOutQuad',
	swing: function (x, t, b, c, d) {
		//alert(jQuery.easing.default);
		return jQuery.easing[jQuery.easing.def](x, t, b, c, d);
	},
	easeInQuad: function (x, t, b, c, d) {
		return c*(t/=d)*t + b;
	},
	easeOutQuad: function (x, t, b, c, d) {
		return -c *(t/=d)*(t-2) + b;
	},
	easeInOutQuad: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t + b;
		return -c/2 * ((--t)*(t-2) - 1) + b;
	},
	easeInCubic: function (x, t, b, c, d) {
		return c*(t/=d)*t*t + b;
	},
	easeOutCubic: function (x, t, b, c, d) {
		return c*((t=t/d-1)*t*t + 1) + b;
	},
	easeInOutCubic: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t*t + b;
		return c/2*((t-=2)*t*t + 2) + b;
	},
	easeInQuart: function (x, t, b, c, d) {
		return c*(t/=d)*t*t*t + b;
	},
	easeOutQuart: function (x, t, b, c, d) {
		return -c * ((t=t/d-1)*t*t*t - 1) + b;
	},
	easeInOutQuart: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t*t*t + b;
		return -c/2 * ((t-=2)*t*t*t - 2) + b;
	},
	easeInQuint: function (x, t, b, c, d) {
		return c*(t/=d)*t*t*t*t + b;
	},
	easeOutQuint: function (x, t, b, c, d) {
		return c*((t=t/d-1)*t*t*t*t + 1) + b;
	},
	easeInOutQuint: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t*t*t*t + b;
		return c/2*((t-=2)*t*t*t*t + 2) + b;
	},
	easeInSine: function (x, t, b, c, d) {
		return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
	},
	easeOutSine: function (x, t, b, c, d) {
		return c * Math.sin(t/d * (Math.PI/2)) + b;
	},
	easeInOutSine: function (x, t, b, c, d) {
		return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;
	},
	easeInExpo: function (x, t, b, c, d) {
		return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
	},
	easeOutExpo: function (x, t, b, c, d) {
		return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
	},
	easeInOutExpo: function (x, t, b, c, d) {
		if (t==0) return b;
		if (t==d) return b+c;
		if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
		return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
	},
	easeInCirc: function (x, t, b, c, d) {
		return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b;
	},
	easeOutCirc: function (x, t, b, c, d) {
		return c * Math.sqrt(1 - (t=t/d-1)*t) + b;
	},
	easeInOutCirc: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
		return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;
	},
	easeInElastic: function (x, t, b, c, d) {
		var s=1.70158;var p=0;var a=c;
		if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
		if (a < Math.abs(c)) { a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin (c/a);
		return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
	},
	easeOutElastic: function (x, t, b, c, d) {
		var s=1.70158;var p=0;var a=c;
		if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
		if (a < Math.abs(c)) { a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin (c/a);
		return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;
	},
	easeInOutElastic: function (x, t, b, c, d) {
		var s=1.70158;var p=0;var a=c;
		if (t==0) return b;  if ((t/=d/2)==2) return b+c;  if (!p) p=d*(.3*1.5);
		if (a < Math.abs(c)) { a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin (c/a);
		if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
		return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*.5 + c + b;
	},
	easeInBack: function (x, t, b, c, d, s) {
		if (s == undefined) s = 1.70158;
		return c*(t/=d)*t*((s+1)*t - s) + b;
	},
	easeOutBack: function (x, t, b, c, d, s) {
		if (s == undefined) s = 1.70158;
		return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
	},
	easeInOutBack: function (x, t, b, c, d, s) {
		if (s == undefined) s = 1.70158; 
		if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
		return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
	},
	easeInBounce: function (x, t, b, c, d) {
		return c - jQuery.easing.easeOutBounce (x, d-t, 0, c, d) + b;
	},
	easeOutBounce: function (x, t, b, c, d) {
		if ((t/=d) < (1/2.75)) {
			return c*(7.5625*t*t) + b;
		} else if (t < (2/2.75)) {
			return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
		} else if (t < (2.5/2.75)) {
			return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
		} else {
			return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
		}
	},
	easeInOutBounce: function (x, t, b, c, d) {
		if (t < d/2) return jQuery.easing.easeInBounce (x, t*2, 0, c, d) * .5 + b;
		return jQuery.easing.easeOutBounce (x, t*2-d, 0, c, d) * .5 + c*.5 + b;
	}
});

/*
 *
 * TERMS OF USE - EASING EQUATIONS
 * 
 * Open source under the BSD License. 
 * 
 * Copyright © 2001 Robert Penner
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, 
 * are permitted provided that the following conditions are met:
 * 
 * Redistributions of source code must retain the above copyright notice, this list of 
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list 
 * of conditions and the following disclaimer in the documentation and/or other materials 
 * provided with the distribution.
 * 
 * Neither the name of the author nor the names of contributors may be used to endorse 
 * or promote products derived from this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY 
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED 
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED 
 * OF THE POSSIBILITY OF SUCH DAMAGE. 
 *
 */
;/*
 * jQuery mmenu v5.7.8
 * @requires jQuery 1.7.0 or later
 *
 * mmenu.frebsite.nl
 *	
 * Copyright (c) Fred Heusschen
 * www.frebsite.nl
 *
 * License: CC-BY-NC-4.0
 * http://creativecommons.org/licenses/by-nc/4.0/
 */
!function(e){function n(){e[t].glbl||(r={$wndw:e(window),$docu:e(document),$html:e("html"),$body:e("body")},s={},a={},o={},e.each([s,a,o],function(e,n){n.add=function(e){e=e.split(" ");for(var t=0,i=e.length;t<i;t++)n[e[t]]=n.mm(e[t])}}),s.mm=function(e){return"mm-"+e},s.add("wrapper menu panels panel nopanel current highest opened subopened navbar hasnavbar title btn prev next listview nolistview inset vertical selected divider spacer hidden fullsubopen"),s.umm=function(e){return"mm-"==e.slice(0,3)&&(e=e.slice(3)),e},a.mm=function(e){return"mm-"+e},a.add("parent child"),o.mm=function(e){return e+".mm"},o.add("transitionend webkitTransitionEnd click scroll keydown mousedown mouseup touchstart touchmove touchend orientationchange"),e[t]._c=s,e[t]._d=a,e[t]._e=o,e[t].glbl=r)}var t="mmenu",i="5.7.8";if(!(e[t]&&e[t].version>i)){e[t]=function(e,n,t){this.$menu=e,this._api=["bind","getInstance","update","initPanels","openPanel","closePanel","closeAllPanels","setSelected"],this.opts=n,this.conf=t,this.vars={},this.cbck={},"function"==typeof this.___deprecated&&this.___deprecated(),this._initMenu(),this._initAnchors();var i=this.$pnls.children();return this._initAddons(),this.initPanels(i),"function"==typeof this.___debug&&this.___debug(),this},e[t].version=i,e[t].addons={},e[t].uniqueId=0,e[t].defaults={extensions:[],initMenu:function(){},initPanels:function(){},navbar:{add:!0,title:"Menu",titleLink:"panel"},onClick:{setSelected:!0},slidingSubmenus:!0},e[t].configuration={classNames:{divider:"Divider",inset:"Inset",panel:"Panel",selected:"Selected",spacer:"Spacer",vertical:"Vertical"},clone:!1,openingInterval:25,panelNodetype:"ul, ol, div",transitionDuration:400},e[t].prototype={init:function(e){this.initPanels(e)},getInstance:function(){return this},update:function(){this.trigger("update")},initPanels:function(e){e=e.not("."+s.nopanel),e=this._initPanels(e),this.opts.initPanels.call(this,e),this.trigger("initPanels",e),this.trigger("update")},openPanel:function(n){var i=n.parent(),a=this;if(i.hasClass(s.vertical)){var o=i.parents("."+s.subopened);if(o.length)return void this.openPanel(o.first());i.addClass(s.opened),this.trigger("openPanel",n),this.trigger("openingPanel",n),this.trigger("openedPanel",n)}else{if(n.hasClass(s.current))return;var r=this.$pnls.children("."+s.panel),l=r.filter("."+s.current);r.removeClass(s.highest).removeClass(s.current).not(n).not(l).not("."+s.vertical).addClass(s.hidden),e[t].support.csstransitions||l.addClass(s.hidden),n.hasClass(s.opened)?n.nextAll("."+s.opened).addClass(s.highest).removeClass(s.opened).removeClass(s.subopened):(n.addClass(s.highest),l.addClass(s.subopened)),n.removeClass(s.hidden).addClass(s.current),a.trigger("openPanel",n),setTimeout(function(){n.removeClass(s.subopened).addClass(s.opened),a.trigger("openingPanel",n),a.__transitionend(n,function(){a.trigger("openedPanel",n)},a.conf.transitionDuration)},this.conf.openingInterval)}},closePanel:function(e){var n=e.parent();n.hasClass(s.vertical)&&(n.removeClass(s.opened),this.trigger("closePanel",e),this.trigger("closingPanel",e),this.trigger("closedPanel",e))},closeAllPanels:function(){this.$menu.find("."+s.listview).children().removeClass(s.selected).filter("."+s.vertical).removeClass(s.opened);var e=this.$pnls.children("."+s.panel),n=e.first();this.$pnls.children("."+s.panel).not(n).removeClass(s.subopened).removeClass(s.opened).removeClass(s.current).removeClass(s.highest).addClass(s.hidden),this.openPanel(n)},togglePanel:function(e){var n=e.parent();n.hasClass(s.vertical)&&this[n.hasClass(s.opened)?"closePanel":"openPanel"](e)},setSelected:function(e){this.$menu.find("."+s.listview).children("."+s.selected).removeClass(s.selected),e.addClass(s.selected),this.trigger("setSelected",e)},bind:function(e,n){e="init"==e?"initPanels":e,this.cbck[e]=this.cbck[e]||[],this.cbck[e].push(n)},trigger:function(){var e=this,n=Array.prototype.slice.call(arguments),t=n.shift();if(t="init"==t?"initPanels":t,this.cbck[t])for(var i=0,s=this.cbck[t].length;i<s;i++)this.cbck[t][i].apply(e,n)},_initMenu:function(){this.conf.clone&&(this.$orig=this.$menu,this.$menu=this.$orig.clone(!0),this.$menu.add(this.$menu.find("[id]")).filter("[id]").each(function(){e(this).attr("id",s.mm(e(this).attr("id")))})),this.opts.initMenu.call(this,this.$menu,this.$orig),this.$menu.attr("id",this.$menu.attr("id")||this.__getUniqueId()),this.$pnls=e('<div class="'+s.panels+'" />').append(this.$menu.children(this.conf.panelNodetype)).prependTo(this.$menu),this.$menu.parent().addClass(s.wrapper);var n=[s.menu];this.opts.slidingSubmenus||n.push(s.vertical),this.opts.extensions=this.opts.extensions.length?"mm-"+this.opts.extensions.join(" mm-"):"",this.opts.extensions&&n.push(this.opts.extensions),this.$menu.addClass(n.join(" ")),this.trigger("_initMenu")},_initPanels:function(n){var i=this,o=this.__findAddBack(n,"ul, ol");this.__refactorClass(o,this.conf.classNames.inset,"inset").addClass(s.nolistview+" "+s.nopanel),o.not("."+s.nolistview).addClass(s.listview);var r=this.__findAddBack(n,"."+s.listview).children();this.__refactorClass(r,this.conf.classNames.selected,"selected"),this.__refactorClass(r,this.conf.classNames.divider,"divider"),this.__refactorClass(r,this.conf.classNames.spacer,"spacer"),this.__refactorClass(this.__findAddBack(n,"."+this.conf.classNames.panel),this.conf.classNames.panel,"panel");var l=e(),d=n.add(n.find("."+s.panel)).add(this.__findAddBack(n,"."+s.listview).children().children(this.conf.panelNodetype)).not("."+s.nopanel);this.__refactorClass(d,this.conf.classNames.vertical,"vertical"),this.opts.slidingSubmenus||d.addClass(s.vertical),d.each(function(){var n=e(this),t=n;n.is("ul, ol")?(n.wrap('<div class="'+s.panel+'" />'),t=n.parent()):t.addClass(s.panel);var a=n.attr("id");n.removeAttr("id"),t.attr("id",a||i.__getUniqueId()),n.hasClass(s.vertical)&&(n.removeClass(i.conf.classNames.vertical),t.add(t.parent()).addClass(s.vertical)),l=l.add(t)});var c=e("."+s.panel,this.$menu);l.each(function(n){var o,r,l=e(this),d=l.parent(),c=d.children("a, span").first();if(d.is("."+s.panels)||(d.data(a.child,l),l.data(a.parent,d)),d.children("."+s.next).length||d.parent().is("."+s.listview)&&(o=l.attr("id"),r=e('<a class="'+s.next+'" href="#'+o+'" data-target="#'+o+'" />').insertBefore(c),c.is("span")&&r.addClass(s.fullsubopen)),!l.children("."+s.navbar).length&&!d.hasClass(s.vertical)){d.parent().is("."+s.listview)?d=d.closest("."+s.panel):(c=d.closest("."+s.panel).find('a[href="#'+l.attr("id")+'"]').first(),d=c.closest("."+s.panel));var h=!1,u=e('<div class="'+s.navbar+'" />');if(i.opts.navbar.add&&l.addClass(s.hasnavbar),d.length){switch(o=d.attr("id"),i.opts.navbar.titleLink){case"anchor":h=c.attr("href");break;case"panel":case"parent":h="#"+o;break;default:h=!1}u.append('<a class="'+s.btn+" "+s.prev+'" href="#'+o+'" data-target="#'+o+'" />').append(e('<a class="'+s.title+'"'+(h?' href="'+h+'"':"")+" />").text(c.text())).prependTo(l)}else i.opts.navbar.title&&u.append('<a class="'+s.title+'">'+e[t].i18n(i.opts.navbar.title)+"</a>").prependTo(l)}});var h=this.__findAddBack(n,"."+s.listview).children("."+s.selected).removeClass(s.selected).last().addClass(s.selected);h.add(h.parentsUntil("."+s.menu,"li")).filter("."+s.vertical).addClass(s.opened).end().each(function(){e(this).parentsUntil("."+s.menu,"."+s.panel).not("."+s.vertical).first().addClass(s.opened).parentsUntil("."+s.menu,"."+s.panel).not("."+s.vertical).first().addClass(s.opened).addClass(s.subopened)}),h.children("."+s.panel).not("."+s.vertical).addClass(s.opened).parentsUntil("."+s.menu,"."+s.panel).not("."+s.vertical).first().addClass(s.opened).addClass(s.subopened);var u=c.filter("."+s.opened);return u.length||(u=l.first()),u.addClass(s.opened).last().addClass(s.current),l.not("."+s.vertical).not(u.last()).addClass(s.hidden).end().filter(function(){return!e(this).parent().hasClass(s.panels)}).appendTo(this.$pnls),this.trigger("_initPanels",l),l},_initAnchors:function(){var n=this;r.$body.on(o.click+"-oncanvas","a[href]",function(i){var a=e(this),o=!1,r=n.$menu.find(a).length;for(var l in e[t].addons)if(e[t].addons[l].clickAnchor.call(n,a,r)){o=!0;break}var d=a.attr("href");if(!o&&r&&d.length>1&&"#"==d.slice(0,1))try{var c=e(d,n.$menu);c.is("."+s.panel)&&(o=!0,n[a.parent().hasClass(s.vertical)?"togglePanel":"openPanel"](c))}catch(h){}if(o&&i.preventDefault(),!o&&r&&a.is("."+s.listview+" > li > a")&&!a.is('[rel="external"]')&&!a.is('[target="_blank"]')){n.__valueOrFn(n.opts.onClick.setSelected,a)&&n.setSelected(e(i.target).parent());var u=n.__valueOrFn(n.opts.onClick.preventDefault,a,"#"==d.slice(0,1));u&&i.preventDefault(),n.__valueOrFn(n.opts.onClick.close,a,u)&&n.close()}}),this.trigger("_initAnchors")},_initAddons:function(){var n;for(n in e[t].addons)e[t].addons[n].add.call(this),e[t].addons[n].add=function(){};for(n in e[t].addons)e[t].addons[n].setup.call(this);this.trigger("_initAddons")},_getOriginalMenuId:function(){var e=this.$menu.attr("id");return e&&e.length&&this.conf.clone&&(e=s.umm(e)),e},__api:function(){var n=this,t={};return e.each(this._api,function(e){var i=this;t[i]=function(){var e=n[i].apply(n,arguments);return"undefined"==typeof e?t:e}}),t},__valueOrFn:function(e,n,t){return"function"==typeof e?e.call(n[0]):"undefined"==typeof e&&"undefined"!=typeof t?t:e},__refactorClass:function(e,n,t){return e.filter("."+n).removeClass(n).addClass(s[t])},__findAddBack:function(e,n){return e.find(n).add(e.filter(n))},__filterListItems:function(e){return e.not("."+s.divider).not("."+s.hidden)},__transitionend:function(n,t,i){var s=!1,a=function(i){if("undefined"!=typeof i){if(!e(i.target).is(n))return!1;n.unbind(o.transitionend),n.unbind(o.webkitTransitionEnd)}s||t.call(n[0]),s=!0};n.on(o.transitionend,a),n.on(o.webkitTransitionEnd,a),setTimeout(a,1.1*i)},__getUniqueId:function(){return s.mm(e[t].uniqueId++)}},e.fn[t]=function(i,s){n(),i=e.extend(!0,{},e[t].defaults,i),s=e.extend(!0,{},e[t].configuration,s);var a=e();return this.each(function(){var n=e(this);if(!n.data(t)){var o=new e[t](n,i,s);o.$menu.data(t,o.__api()),a=a.add(o.$menu)}}),a},e[t].i18n=function(){var n={};return function(t){switch(typeof t){case"object":return e.extend(n,t),n;case"string":return n[t]||t;case"undefined":default:return n}}}(),e[t].support={touch:"ontouchstart"in window||navigator.msMaxTouchPoints||!1,csstransitions:function(){if("undefined"!=typeof Modernizr&&"undefined"!=typeof Modernizr.csstransitions)return Modernizr.csstransitions;var e=document.body||document.documentElement,n=e.style,t="transition";if("string"==typeof n[t])return!0;var i=["Moz","webkit","Webkit","Khtml","O","ms"];t=t.charAt(0).toUpperCase()+t.substr(1);for(var s=0;s<i.length;s++)if("string"==typeof n[i[s]+t])return!0;return!1}(),csstransforms:function(){return"undefined"==typeof Modernizr||"undefined"==typeof Modernizr.csstransforms||Modernizr.csstransforms}(),csstransforms3d:function(){return"undefined"==typeof Modernizr||"undefined"==typeof Modernizr.csstransforms3d||Modernizr.csstransforms3d}()};var s,a,o,r}}(jQuery),/*	
 * jQuery mmenu offCanvas add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="offCanvas";e[n].addons[t]={setup:function(){if(this.opts[t]){var s=this.opts[t],a=this.conf[t];o=e[n].glbl,this._api=e.merge(this._api,["open","close","setPage"]),"top"!=s.position&&"bottom"!=s.position||(s.zposition="front"),"string"!=typeof a.pageSelector&&(a.pageSelector="> "+a.pageNodetype),o.$allMenus=(o.$allMenus||e()).add(this.$menu),this.vars.opened=!1;var r=[i.offcanvas];"left"!=s.position&&r.push(i.mm(s.position)),"back"!=s.zposition&&r.push(i.mm(s.zposition)),this.$menu.addClass(r.join(" ")).parent().removeClass(i.wrapper),e[n].support.csstransforms||this.$menu.addClass(i["no-csstransforms"]),e[n].support.csstransforms3d||this.$menu.addClass(i["no-csstransforms3d"]),this.setPage(o.$page),this._initBlocker(),this["_initWindow_"+t](),this.$menu[a.menuInjectMethod+"To"](a.menuWrapperSelector);var l=window.location.hash;if(l){var d=this._getOriginalMenuId();d&&d==l.slice(1)&&this.open()}}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("offcanvas slideout blocking modal background opening blocker page no-csstransforms3d"),s.add("style"),a.add("resize")},clickAnchor:function(e,n){var s=this;if(this.opts[t]){var a=this._getOriginalMenuId();if(a&&e.is('[href="#'+a+'"]')){if(n)return!0;var r=e.closest("."+i.menu);if(r.length){var l=r.data("mmenu");if(l&&l.close)return l.close(),s.__transitionend(r,function(){s.open()},s.conf.transitionDuration),!0}return this.open(),!0}if(o.$page)return a=o.$page.first().attr("id"),a&&e.is('[href="#'+a+'"]')?(this.close(),!0):void 0}}},e[n].defaults[t]={position:"left",zposition:"back",blockUI:!0,moveBackground:!0},e[n].configuration[t]={pageNodetype:"div",pageSelector:null,noPageSelector:[],wrapPageIfNeeded:!0,menuWrapperSelector:"body",menuInjectMethod:"prepend"},e[n].prototype.open=function(){if(!this.vars.opened){var e=this;this._openSetup(),setTimeout(function(){e._openFinish()},this.conf.openingInterval),this.trigger("open")}},e[n].prototype._openSetup=function(){var n=this,r=this.opts[t];this.closeAllOthers(),o.$page.each(function(){e(this).data(s.style,e(this).attr("style")||"")}),o.$wndw.trigger(a.resize+"-"+t,[!0]);var l=[i.opened];r.blockUI&&l.push(i.blocking),"modal"==r.blockUI&&l.push(i.modal),r.moveBackground&&l.push(i.background),"left"!=r.position&&l.push(i.mm(this.opts[t].position)),"back"!=r.zposition&&l.push(i.mm(this.opts[t].zposition)),this.opts.extensions&&l.push(this.opts.extensions),o.$html.addClass(l.join(" ")),setTimeout(function(){n.vars.opened=!0},this.conf.openingInterval),this.$menu.addClass(i.current+" "+i.opened)},e[n].prototype._openFinish=function(){var e=this;this.__transitionend(o.$page.first(),function(){e.trigger("opened")},this.conf.transitionDuration),o.$html.addClass(i.opening),this.trigger("opening")},e[n].prototype.close=function(){if(this.vars.opened){var n=this;this.__transitionend(o.$page.first(),function(){n.$menu.removeClass(i.current+" "+i.opened);var a=[i.opened,i.blocking,i.modal,i.background,i.mm(n.opts[t].position),i.mm(n.opts[t].zposition)];n.opts.extensions&&a.push(n.opts.extensions),o.$html.removeClass(a.join(" ")),o.$page.each(function(){e(this).attr("style",e(this).data(s.style))}),n.vars.opened=!1,n.trigger("closed")},this.conf.transitionDuration),o.$html.removeClass(i.opening),this.trigger("close"),this.trigger("closing")}},e[n].prototype.closeAllOthers=function(){o.$allMenus.not(this.$menu).each(function(){var t=e(this).data(n);t&&t.close&&t.close()})},e[n].prototype.setPage=function(n){var s=this,a=this.conf[t];n&&n.length||(n=o.$body.find(a.pageSelector),a.noPageSelector.length&&(n=n.not(a.noPageSelector.join(", "))),n.length>1&&a.wrapPageIfNeeded&&(n=n.wrapAll("<"+this.conf[t].pageNodetype+" />").parent())),n.each(function(){e(this).attr("id",e(this).attr("id")||s.__getUniqueId())}),n.addClass(i.page+" "+i.slideout),o.$page=n,this.trigger("setPage",n)},e[n].prototype["_initWindow_"+t]=function(){o.$wndw.off(a.keydown+"-"+t).on(a.keydown+"-"+t,function(e){if(o.$html.hasClass(i.opened)&&9==e.keyCode)return e.preventDefault(),!1});var e=0;o.$wndw.off(a.resize+"-"+t).on(a.resize+"-"+t,function(n,t){if(1==o.$page.length&&(t||o.$html.hasClass(i.opened))){var s=o.$wndw.height();(t||s!=e)&&(e=s,o.$page.css("minHeight",s))}})},e[n].prototype._initBlocker=function(){var n=this;this.opts[t].blockUI&&(o.$blck||(o.$blck=e('<div id="'+i.blocker+'" class="'+i.slideout+'" />')),o.$blck.appendTo(o.$body).off(a.touchstart+"-"+t+" "+a.touchmove+"-"+t).on(a.touchstart+"-"+t+" "+a.touchmove+"-"+t,function(e){e.preventDefault(),e.stopPropagation(),o.$blck.trigger(a.mousedown+"-"+t)}).off(a.mousedown+"-"+t).on(a.mousedown+"-"+t,function(e){e.preventDefault(),o.$html.hasClass(i.modal)||(n.closeAllOthers(),n.close())}))};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu scrollBugFix add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="scrollBugFix";e[n].addons[t]={setup:function(){var s=this,r=this.opts[t];this.conf[t];if(o=e[n].glbl,e[n].support.touch&&this.opts.offCanvas&&this.opts.offCanvas.blockUI&&("boolean"==typeof r&&(r={fix:r}),"object"!=typeof r&&(r={}),r=this.opts[t]=e.extend(!0,{},e[n].defaults[t],r),r.fix)){var l=this.$menu.attr("id"),d=!1;this.bind("opening",function(){this.$pnls.children("."+i.current).scrollTop(0)}),o.$docu.on(a.touchmove,function(e){s.vars.opened&&e.preventDefault()}),o.$body.on(a.touchstart,"#"+l+"> ."+i.panels+"> ."+i.current,function(e){s.vars.opened&&(d||(d=!0,0===e.currentTarget.scrollTop?e.currentTarget.scrollTop=1:e.currentTarget.scrollHeight===e.currentTarget.scrollTop+e.currentTarget.offsetHeight&&(e.currentTarget.scrollTop-=1),d=!1))}).on(a.touchmove,"#"+l+"> ."+i.panels+"> ."+i.current,function(n){s.vars.opened&&e(this)[0].scrollHeight>e(this).innerHeight()&&n.stopPropagation()}),o.$wndw.on(a.orientationchange,function(){s.$pnls.children("."+i.current).scrollTop(0).css({"-webkit-overflow-scrolling":"auto"}).css({"-webkit-overflow-scrolling":"touch"})})}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e},clickAnchor:function(e,n){}},e[n].defaults[t]={fix:!0};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu autoHeight add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="autoHeight";e[n].addons[t]={setup:function(){if(this.opts.offCanvas){var s=this.opts[t];this.conf[t];if(o=e[n].glbl,"boolean"==typeof s&&s&&(s={height:"auto"}),"string"==typeof s&&(s={height:s}),"object"!=typeof s&&(s={}),s=this.opts[t]=e.extend(!0,{},e[n].defaults[t],s),"auto"==s.height||"highest"==s.height){this.$menu.addClass(i.autoheight);var a=function(n){if(this.vars.opened){var t=parseInt(this.$pnls.css("top"),10)||0,a=parseInt(this.$pnls.css("bottom"),10)||0,o=0;this.$menu.addClass(i.measureheight),"auto"==s.height?(n=n||this.$pnls.children("."+i.current),n.is("."+i.vertical)&&(n=n.parents("."+i.panel).not("."+i.vertical).first()),o=n.outerHeight()):"highest"==s.height&&this.$pnls.children().each(function(){var n=e(this);n.is("."+i.vertical)&&(n=n.parents("."+i.panel).not("."+i.vertical).first()),o=Math.max(o,n.outerHeight())}),this.$menu.height(o+t+a).removeClass(i.measureheight)}};this.bind("opening",a),"highest"==s.height&&this.bind("initPanels",a),"auto"==s.height&&(this.bind("update",a),this.bind("openPanel",a),this.bind("closePanel",a))}}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("autoheight measureheight"),a.add("resize")},clickAnchor:function(e,n){}},e[n].defaults[t]={height:"default"};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu backButton add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="backButton";e[n].addons[t]={setup:function(){if(this.opts.offCanvas){var s=this,a=this.opts[t];this.conf[t];if(o=e[n].glbl,"boolean"==typeof a&&(a={close:a}),"object"!=typeof a&&(a={}),a=e.extend(!0,{},e[n].defaults[t],a),a.close){var r="#"+s.$menu.attr("id");this.bind("opened",function(e){location.hash!=r&&history.pushState(null,document.title,r)}),e(window).on("popstate",function(e){o.$html.hasClass(i.opened)?(e.stopPropagation(),s.close()):location.hash==r&&(e.stopPropagation(),s.open())})}}},add:function(){return window.history&&window.history.pushState?(i=e[n]._c,s=e[n]._d,void(a=e[n]._e)):void(e[n].addons[t].setup=function(){})},clickAnchor:function(e,n){}},e[n].defaults[t]={close:!1};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu columns add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="columns";e[n].addons[t]={setup:function(){var s=this.opts[t];this.conf[t];if(o=e[n].glbl,"boolean"==typeof s&&(s={add:s}),"number"==typeof s&&(s={add:!0,visible:s}),"object"!=typeof s&&(s={}),"number"==typeof s.visible&&(s.visible={min:s.visible,max:s.visible}),s=this.opts[t]=e.extend(!0,{},e[n].defaults[t],s),s.add){s.visible.min=Math.max(1,Math.min(6,s.visible.min)),s.visible.max=Math.max(s.visible.min,Math.min(6,s.visible.max)),this.$menu.addClass(i.columns);for(var a=this.opts.offCanvas?this.$menu.add(o.$html):this.$menu,r=[],l=0;l<=s.visible.max;l++)r.push(i.columns+"-"+l);r=r.join(" ");var d=function(e){u.call(this,this.$pnls.children("."+i.current))},c=function(){var e=this.$pnls.children("."+i.panel).filter("."+i.opened).length;e=Math.min(s.visible.max,Math.max(s.visible.min,e)),a.removeClass(r).addClass(i.columns+"-"+e)},h=function(){this.opts.offCanvas&&o.$html.removeClass(r)},u=function(n){this.$pnls.children("."+i.panel).removeClass(r).filter("."+i.subopened).removeClass(i.hidden).add(n).slice(-s.visible.max).each(function(n){e(this).addClass(i.columns+"-"+n)})};this.bind("open",c),this.bind("close",h),this.bind("initPanels",d),this.bind("openPanel",u),this.bind("openingPanel",c),this.bind("openedPanel",c),this.opts.offCanvas||c.call(this)}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("columns")},clickAnchor:function(n,s){if(!this.opts[t].add)return!1;if(s){var a=n.attr("href");if(a.length>1&&"#"==a.slice(0,1))try{var o=e(a,this.$menu);if(o.is("."+i.panel))for(var r=parseInt(n.closest("."+i.panel).attr("class").split(i.columns+"-")[1].split(" ")[0],10)+1;r!==!1;){var l=this.$pnls.children("."+i.columns+"-"+r);if(!l.length){r=!1;break}r++,l.removeClass(i.subopened).removeClass(i.opened).removeClass(i.current).removeClass(i.highest).addClass(i.hidden)}}catch(d){}}}},e[n].defaults[t]={add:!1,visible:{min:1,max:3}};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu counters add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="counters";e[n].addons[t]={setup:function(){var a=this,r=this.opts[t];this.conf[t];o=e[n].glbl,"boolean"==typeof r&&(r={add:r,update:r}),"object"!=typeof r&&(r={}),r=this.opts[t]=e.extend(!0,{},e[n].defaults[t],r),this.bind("initPanels",function(n){this.__refactorClass(e("em",n),this.conf.classNames[t].counter,"counter")}),r.add&&this.bind("initPanels",function(n){var t;switch(r.addTo){case"panels":t=n;break;default:t=n.filter(r.addTo)}t.each(function(){var n=e(this).data(s.parent);n&&(n.children("em."+i.counter).length||n.prepend(e('<em class="'+i.counter+'" />')))})}),r.update&&this.bind("update",function(){this.$pnls.find("."+i.panel).each(function(){var n=e(this),t=n.data(s.parent);if(t){var o=t.children("em."+i.counter);o.length&&(n=n.children("."+i.listview),n.length&&o.html(a.__filterListItems(n.children()).length))}})})},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("counter search noresultsmsg")},clickAnchor:function(e,n){}},e[n].defaults[t]={add:!1,addTo:"panels",update:!1},e[n].configuration.classNames[t]={counter:"Counter"};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu dividers add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="dividers";e[n].addons[t]={setup:function(){var s=this,r=this.opts[t];this.conf[t];if(o=e[n].glbl,"boolean"==typeof r&&(r={add:r,fixed:r}),"object"!=typeof r&&(r={}),r=this.opts[t]=e.extend(!0,{},e[n].defaults[t],r),this.bind("initPanels",function(n){this.__refactorClass(e("li",this.$menu),this.conf.classNames[t].collapsed,"collapsed")}),r.add&&this.bind("initPanels",function(n){var t;switch(r.addTo){case"panels":t=n;break;default:t=n.filter(r.addTo)}e("."+i.divider,t).remove(),t.find("."+i.listview).not("."+i.vertical).each(function(){var n="";s.__filterListItems(e(this).children()).each(function(){var t=e.trim(e(this).children("a, span").text()).slice(0,1).toLowerCase();t!=n&&t.length&&(n=t,e('<li class="'+i.divider+'">'+t+"</li>").insertBefore(this))})})}),r.collapse&&this.bind("initPanels",function(n){e("."+i.divider,n).each(function(){var n=e(this),t=n.nextUntil("."+i.divider,"."+i.collapsed);t.length&&(n.children("."+i.subopen).length||(n.wrapInner("<span />"),n.prepend('<a href="#" class="'+i.subopen+" "+i.fullsubopen+'" />')))})}),r.fixed){var l=function(n){n=n||this.$pnls.children("."+i.current);var t=n.find("."+i.divider).not("."+i.hidden);if(t.length){this.$menu.addClass(i.hasdividers);var s=n.scrollTop()||0,a="";n.is(":visible")&&n.find("."+i.divider).not("."+i.hidden).each(function(){e(this).position().top+s<s+1&&(a=e(this).text())}),this.$fixeddivider.text(a)}else this.$menu.removeClass(i.hasdividers)};this.$fixeddivider=e('<ul class="'+i.listview+" "+i.fixeddivider+'"><li class="'+i.divider+'"></li></ul>').prependTo(this.$pnls).children(),this.bind("openPanel",l),this.bind("update",l),this.bind("initPanels",function(n){n.off(a.scroll+"-dividers "+a.touchmove+"-dividers").on(a.scroll+"-dividers "+a.touchmove+"-dividers",function(n){l.call(s,e(this))})})}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("collapsed uncollapsed fixeddivider hasdividers"),a.add("scroll")},clickAnchor:function(e,n){if(this.opts[t].collapse&&n){var s=e.parent();if(s.is("."+i.divider)){var a=s.nextUntil("."+i.divider,"."+i.collapsed);return s.toggleClass(i.opened),a[s.hasClass(i.opened)?"addClass":"removeClass"](i.uncollapsed),!0}}return!1}},e[n].defaults[t]={add:!1,addTo:"panels",fixed:!1,collapse:!1},e[n].configuration.classNames[t]={collapsed:"Collapsed"};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu drag add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){function n(e,n,t){return e<n&&(e=n),e>t&&(e=t),e}function t(t,i,s){var r,l,d,c,h,u=this,f={},p=0,v=!1,m=!1,g=0,b=0;switch(this.opts.offCanvas.position){case"left":case"right":f.events="panleft panright",f.typeLower="x",f.typeUpper="X",m="width";break;case"top":case"bottom":f.events="panup pandown",f.typeLower="y",f.typeUpper="Y",m="height"}switch(this.opts.offCanvas.position){case"right":case"bottom":f.negative=!0,c=function(e){e>=s.$wndw[m]()-t.maxStartPos&&(p=1)};break;default:f.negative=!1,c=function(e){e<=t.maxStartPos&&(p=1)}}switch(this.opts.offCanvas.position){case"left":f.open_dir="right",f.close_dir="left";break;case"right":f.open_dir="left",f.close_dir="right";break;case"top":f.open_dir="down",f.close_dir="up";break;case"bottom":f.open_dir="up",f.close_dir="down"}switch(this.opts.offCanvas.zposition){case"front":h=function(){return this.$menu};break;default:h=function(){return e("."+o.slideout)}}var _=this.__valueOrFn(t.node,this.$menu,s.$page);"string"==typeof _&&(_=e(_));var C=new Hammer(_[0],this.opts[a].vendors.hammer);C.on("panstart",function(e){c(e.center[f.typeLower]),s.$slideOutNodes=h(),v=f.open_dir}).on(f.events+" panend",function(e){p>0&&e.preventDefault()}).on(f.events,function(e){if(r=e["delta"+f.typeUpper],f.negative&&(r=-r),r!=g&&(v=r>=g?f.open_dir:f.close_dir),g=r,g>t.threshold&&1==p){if(s.$html.hasClass(o.opened))return;p=2,u._openSetup(),u.trigger("opening"),s.$html.addClass(o.dragging),b=n(s.$wndw[m]()*i[m].perc,i[m].min,i[m].max)}2==p&&(l=n(g,10,b)-("front"==u.opts.offCanvas.zposition?b:0),f.negative&&(l=-l),d="translate"+f.typeUpper+"("+l+"px )",s.$slideOutNodes.css({"-webkit-transform":"-webkit-"+d,transform:d}))}).on("panend",function(e){2==p&&(s.$html.removeClass(o.dragging),s.$slideOutNodes.css("transform",""),u[v==f.open_dir?"_openFinish":"close"]()),p=0})}function i(n,t,i,s){var l=this;n.each(function(){var n=e(this),t=n.data(r.parent);if(t&&(t=t.closest("."+o.panel),t.length)){var i=new Hammer(n[0],l.opts[a].vendors.hammer);i.on("panright",function(e){l.openPanel(t)})}})}var s="mmenu",a="drag";e[s].addons[a]={setup:function(){if(this.opts.offCanvas){var n=this.opts[a],o=this.conf[a];d=e[s].glbl,"boolean"==typeof n&&(n={menu:n,panels:n}),"object"!=typeof n&&(n={}),"boolean"==typeof n.menu&&(n.menu={open:n.menu}),"object"!=typeof n.menu&&(n.menu={}),"boolean"==typeof n.panels&&(n.panels={close:n.panels}),"object"!=typeof n.panels&&(n.panels={}),n=this.opts[a]=e.extend(!0,{},e[s].defaults[a],n),n.menu.open&&t.call(this,n.menu,o.menu,d),n.panels.close&&this.bind("initPanels",function(e){i.call(this,e,n.panels,o.panels,d)})}},add:function(){return"function"!=typeof Hammer||Hammer.VERSION<2?void(e[s].addons[a].setup=function(){}):(o=e[s]._c,r=e[s]._d,l=e[s]._e,void o.add("dragging"))},clickAnchor:function(e,n){}},e[s].defaults[a]={menu:{open:!1,maxStartPos:100,threshold:50},panels:{close:!1},vendors:{hammer:{}}},e[s].configuration[a]={menu:{width:{perc:.8,min:140,max:440},height:{perc:.8,min:140,max:880}},panels:{}};var o,r,l,d}(jQuery),/*	
 * jQuery mmenu fixedElements add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="fixedElements";e[n].addons[t]={setup:function(){if(this.opts.offCanvas){var i=this.opts[t];this.conf[t];o=e[n].glbl,i=this.opts[t]=e.extend(!0,{},e[n].defaults[t],i);var s=function(e){var n=this.conf.classNames[t].fixed;this.__refactorClass(e.find("."+n),n,"slideout").appendTo(o.$body)};s.call(this,o.$page),this.bind("setPage",s)}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("fixed")},clickAnchor:function(e,n){}},e[n].configuration.classNames[t]={fixed:"Fixed"};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu dropdown add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="dropdown";e[n].addons[t]={setup:function(){if(this.opts.offCanvas){var r=this,l=this.opts[t],d=this.conf[t];if(o=e[n].glbl,"boolean"==typeof l&&l&&(l={drop:l}),"object"!=typeof l&&(l={}),"string"==typeof l.position&&(l.position={of:l.position}),l=this.opts[t]=e.extend(!0,{},e[n].defaults[t],l),l.drop){if("string"!=typeof l.position.of){var c=this.$menu.attr("id");c&&c.length&&(this.conf.clone&&(c=i.umm(c)),l.position.of='[href="#'+c+'"]')}if("string"==typeof l.position.of){var h=e(l.position.of);if(h.length){this.$menu.addClass(i.dropdown),l.tip&&this.$menu.addClass(i.tip),l.event=l.event.split(" "),1==l.event.length&&(l.event[1]=l.event[0]),"hover"==l.event[0]&&h.on(a.mouseenter+"-dropdown",function(){r.open()}),"hover"==l.event[1]&&this.$menu.on(a.mouseleave+"-dropdown",function(){r.close()}),this.bind("opening",function(){this.$menu.data(s.style,this.$menu.attr("style")||""),o.$html.addClass(i.dropdown)}),this.bind("closed",function(){this.$menu.attr("style",this.$menu.data(s.style)),o.$html.removeClass(i.dropdown)});var u=function(s,a){var r=a[0],c=a[1],u="x"==s?"scrollLeft":"scrollTop",f="x"==s?"outerWidth":"outerHeight",p="x"==s?"left":"top",v="x"==s?"right":"bottom",m="x"==s?"width":"height",g="x"==s?"maxWidth":"maxHeight",b=null,_=o.$wndw[u](),C=h.offset()[p]-=_,y=C+h[f](),$=o.$wndw[m](),w=d.offset.button[s]+d.offset.viewport[s];if(l.position[s])switch(l.position[s]){case"left":case"bottom":b="after";break;case"right":case"top":b="before"}null===b&&(b=C+(y-C)/2<$/2?"after":"before");var x,k;return"after"==b?(x="x"==s?C:y,k=$-(x+w),r[p]=x+d.offset.button[s],r[v]="auto",c.push(i["x"==s?"tipleft":"tiptop"])):(x="x"==s?y:C,k=x-w,r[v]="calc( 100% - "+(x-d.offset.button[s])+"px )",r[p]="auto",c.push(i["x"==s?"tipright":"tipbottom"])),r[g]=Math.min(e[n].configuration[t][m].max,k),[r,c]},f=function(e){if(this.vars.opened){this.$menu.attr("style",this.$menu.data(s.style));var n=[{},[]];n=u.call(this,"y",n),n=u.call(this,"x",n),this.$menu.css(n[0]),l.tip&&this.$menu.removeClass(i.tipleft+" "+i.tipright+" "+i.tiptop+" "+i.tipbottom).addClass(n[1].join(" "))}};this.bind("opening",f),o.$wndw.on(a.resize+"-dropdown",function(e){f.call(r)}),this.opts.offCanvas.blockUI||o.$wndw.on(a.scroll+"-dropdown",function(e){f.call(r)})}}}}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("dropdown tip tipleft tipright tiptop tipbottom"),a.add("mouseenter mouseleave resize scroll")},clickAnchor:function(e,n){}},e[n].defaults[t]={drop:!1,event:"click",position:{},tip:!0},e[n].configuration[t]={offset:{button:{x:-10,y:10},viewport:{x:20,y:20}},height:{max:880},width:{max:440}};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu iconPanels add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="iconPanels";e[n].addons[t]={setup:function(){var s=this,a=this.opts[t];this.conf[t];if(o=e[n].glbl,"boolean"==typeof a&&(a={add:a}),"number"==typeof a&&(a={add:!0,visible:a}),"object"!=typeof a&&(a={}),a=this.opts[t]=e.extend(!0,{},e[n].defaults[t],a),a.visible++,a.add){this.$menu.addClass(i.iconpanel);for(var r=[],l=0;l<=a.visible;l++)r.push(i.iconpanel+"-"+l);r=r.join(" ");var d=function(n){n.hasClass(i.vertical)||s.$pnls.children("."+i.panel).removeClass(r).filter("."+i.subopened).removeClass(i.hidden).add(n).not("."+i.vertical).slice(-a.visible).each(function(n){e(this).addClass(i.iconpanel+"-"+n)})};this.bind("openPanel",d),this.bind("initPanels",function(n){d.call(s,s.$pnls.children("."+i.current)),n.not("."+i.vertical).each(function(){e(this).children("."+i.subblocker).length||e(this).prepend('<a href="#'+e(this).closest("."+i.panel).attr("id")+'" class="'+i.subblocker+'" />')})})}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("iconpanel subblocker")},clickAnchor:function(e,n){}},e[n].defaults[t]={add:!1,visible:3};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu keyboardNavigation add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){function n(n,t){n||(n=this.$pnls.children("."+a.current));var i=e();"default"==t&&(i=n.children("."+a.listview).find("a[href]").not(":hidden"),i.length||(i=n.find(d).not(":hidden")),i.length||(i=this.$menu.children("."+a.navbar).find(d).not(":hidden"))),i.length||(i=this.$menu.children("."+a.tabstart)),i.first().focus()}function t(e){e||(e=this.$pnls.children("."+a.current));var n=this.$pnls.children("."+a.panel),t=n.not(e);t.find(d).attr("tabindex",-1),e.find(d).attr("tabindex",0),e.find("input.mm-toggle, input.mm-check").attr("tabindex",-1)}var i="mmenu",s="keyboardNavigation";e[i].addons[s]={setup:function(){var o=this,r=this.opts[s];this.conf[s];if(l=e[i].glbl,"boolean"!=typeof r&&"string"!=typeof r||(r={enable:r}),"object"!=typeof r&&(r={}),r=this.opts[s]=e.extend(!0,{},e[i].defaults[s],r),r.enable){r.enhance&&this.$menu.addClass(a.keyboardfocus);var c=e('<input class="'+a.tabstart+'" tabindex="0" type="text" />'),h=e('<input class="'+a.tabend+'" tabindex="0" type="text" />');this.bind("initPanels",function(){this.$menu.prepend(c).append(h).children("."+a.navbar).find(d).attr("tabindex",0)}),this.bind("open",function(){t.call(this),this.__transitionend(this.$menu,function(){n.call(o,null,r.enable)},this.conf.transitionDuration)}),this.bind("openPanel",function(e){t.call(this,e),this.__transitionend(e,function(){n.call(o,e,r.enable)},this.conf.transitionDuration)}),this["_initWindow_"+s](r.enhance)}},add:function(){a=e[i]._c,o=e[i]._d,r=e[i]._e,a.add("tabstart tabend keyboardfocus"),r.add("focusin keydown")},clickAnchor:function(e,n){}},e[i].defaults[s]={enable:!1,enhance:!1},e[i].configuration[s]={},e[i].prototype["_initWindow_"+s]=function(n){l.$wndw.off(r.keydown+"-offCanvas"),l.$wndw.off(r.focusin+"-"+s).on(r.focusin+"-"+s,function(n){if(l.$html.hasClass(a.opened)){var t=e(n.target);t.is("."+a.tabend)&&t.parent().find("."+a.tabstart).focus()}}),l.$wndw.off(r.keydown+"-"+s).on(r.keydown+"-"+s,function(n){var t=e(n.target),i=t.closest("."+a.menu);if(i.length){i.data("mmenu");if(t.is("input, textarea"));else switch(n.keyCode){case 13:(t.is(".mm-toggle")||t.is(".mm-check"))&&t.trigger(r.click);break;case 32:case 37:case 38:case 39:case 40:n.preventDefault()}}}),n&&l.$wndw.on(r.keydown+"-"+s,function(n){var t=e(n.target),i=t.closest("."+a.menu);if(i.length){var s=i.data("mmenu");if(t.is("input, textarea"))switch(n.keyCode){case 27:t.val("")}else switch(n.keyCode){case 8:var r=t.closest("."+a.panel).data(o.parent);r&&r.length&&s.openPanel(r.closest("."+a.panel));break;case 27:i.hasClass(a.offcanvas)&&s.close()}}})};var a,o,r,l,d="input, select, textarea, button, label, a[href]"}(jQuery),/*	
 * jQuery mmenu lazySubmenus add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="lazySubmenus";e[n].addons[t]={setup:function(){var a=this.opts[t];this.conf[t];o=e[n].glbl,"boolean"==typeof a&&(a={load:a}),"object"!=typeof a&&(a={}),a=this.opts[t]=e.extend(!0,{},e[n].defaults[t],a),a.load&&(this.$menu.find("li").find("li").children(this.conf.panelNodetype).each(function(){e(this).parent().addClass(i.lazysubmenu).data(s.lazysubmenu,this).end().remove()}),this.bind("openingPanel",function(n){var t=n.find("."+i.lazysubmenu);t.length&&(t.each(function(){e(this).append(e(this).data(s.lazysubmenu)).removeData(s.lazysubmenu).removeClass(i.lazysubmenu)}),this.initPanels(n))}))},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("lazysubmenu"),s.add("lazysubmenu")},clickAnchor:function(e,n){}},e[n].defaults[t]={load:!1},e[n].configuration[t]={};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu navbar add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="navbars";e[n].addons[t]={setup:function(){var s=this,a=this.opts[t],r=this.conf[t];if(o=e[n].glbl,"undefined"!=typeof a){a instanceof Array||(a=[a]);var l={};if(a.length){e.each(a,function(o){var d=a[o];"boolean"==typeof d&&d&&(d={}),"object"!=typeof d&&(d={}),"undefined"==typeof d.content&&(d.content=["prev","title"]),d.content instanceof Array||(d.content=[d.content]),d=e.extend(!0,{},s.opts.navbar,d);var c=d.position,h=d.height;"number"!=typeof h&&(h=1),h=Math.min(4,Math.max(1,h)),"bottom"!=c&&(c="top"),l[c]||(l[c]=0),l[c]++;var u=e("<div />").addClass(i.navbar+" "+i.navbar+"-"+c+" "+i.navbar+"-"+c+"-"+l[c]+" "+i.navbar+"-size-"+h);l[c]+=h-1;for(var f=0,p=0,v=d.content.length;p<v;p++){var m=e[n].addons[t][d.content[p]]||!1;m?f+=m.call(s,u,d,r):(m=d.content[p],m instanceof e||(m=e(d.content[p])),u.append(m))}f+=Math.ceil(u.children().not("."+i.btn).length/h),f>1&&u.addClass(i.navbar+"-content-"+f),u.children("."+i.btn).length&&u.addClass(i.hasbtns),u.prependTo(s.$menu)});for(var d in l)s.$menu.addClass(i.hasnavbar+"-"+d+"-"+l[d])}}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("close hasbtns")},clickAnchor:function(e,n){}},e[n].configuration[t]={breadcrumbSeparator:"/"},e[n].configuration.classNames[t]={};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu navbar add-on breadcrumbs content
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="navbars",i="breadcrumbs";e[n].addons[t][i]=function(t,i,s){var a=e[n]._c,o=e[n]._d;a.add("breadcrumbs separator");var r=e('<span class="'+a.breadcrumbs+'" />').appendTo(t);this.bind("initPanels",function(n){n.removeClass(a.hasnavbar).each(function(){for(var n=[],t=e(this),i=e('<span class="'+a.breadcrumbs+'"></span>'),r=e(this).children().first(),l=!0;r&&r.length;){r.is("."+a.panel)||(r=r.closest("."+a.panel));var d=r.children("."+a.navbar).children("."+a.title).text();n.unshift(l?"<span>"+d+"</span>":'<a href="#'+r.attr("id")+'">'+d+"</a>"),l=!1,r=r.data(o.parent)}i.append(n.join('<span class="'+a.separator+'">'+s.breadcrumbSeparator+"</span>")).appendTo(t.children("."+a.navbar))})});var l=function(){r.html(this.$pnls.children("."+a.current).children("."+a.navbar).children("."+a.breadcrumbs).html())};return this.bind("openPanel",l),this.bind("initPanels",l),0}}(jQuery),/*	
 * jQuery mmenu navbar add-on close content
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="navbars",i="close";e[n].addons[t][i]=function(t,i){var s=e[n]._c,a=e[n].glbl,o=e('<a class="'+s.close+" "+s.btn+'" href="#" />').appendTo(t),r=function(e){o.attr("href","#"+e.attr("id"))};return r.call(this,a.$page),this.bind("setPage",r),-1}}(jQuery),/*
 * jQuery mmenu navbar add-on next content
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="navbars",i="next";e[n].addons[t][i]=function(i,s){var a,o,r,l=e[n]._c,d=e('<a class="'+l.next+" "+l.btn+'" href="#" />').appendTo(i),c=function(e){e=e||this.$pnls.children("."+l.current);var n=e.find("."+this.conf.classNames[t].panelNext);a=n.attr("href"),r=n.attr("aria-owns"),o=n.html(),d[a?"attr":"removeAttr"]("href",a),d[r?"attr":"removeAttr"]("aria-owns",r),d[a||o?"removeClass":"addClass"](l.hidden),d.html(o)};return this.bind("openPanel",c),this.bind("initPanels",function(){c.call(this)}),-1},e[n].configuration.classNames[t].panelNext="Next"}(jQuery),/*
 * jQuery mmenu navbar add-on prev content
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="navbars",i="prev";e[n].addons[t][i]=function(i,s){var a=e[n]._c,o=e('<a class="'+a.prev+" "+a.btn+'" href="#" />').appendTo(i);this.bind("initPanels",function(e){e.removeClass(a.hasnavbar).children("."+a.navbar).addClass(a.hidden)});var r,l,d,c=function(e){if(e=e||this.$pnls.children("."+a.current),!e.hasClass(a.vertical)){var n=e.find("."+this.conf.classNames[t].panelPrev);n.length||(n=e.children("."+a.navbar).children("."+a.prev)),r=n.attr("href"),d=n.attr("aria-owns"),l=n.html(),o[r?"attr":"removeAttr"]("href",r),o[d?"attr":"removeAttr"]("aria-owns",d),o[r||l?"removeClass":"addClass"](a.hidden),o.html(l)}};return this.bind("openPanel",c),this.bind("initPanels",function(){c.call(this)}),-1},e[n].configuration.classNames[t].panelPrev="Prev"}(jQuery),/*	
 * jQuery mmenu navbar add-on searchfield content
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="navbars",i="searchfield";e[n].addons[t][i]=function(t,i){var s=e[n]._c,a=e('<div class="'+s.search+'" />').appendTo(t);return"object"!=typeof this.opts.searchfield&&(this.opts.searchfield={}),this.opts.searchfield.add=!0,this.opts.searchfield.addTo=a,0}}(jQuery),/*	
 * jQuery mmenu navbar add-on title content
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="navbars",i="title";e[n].addons[t][i]=function(i,s){var a,o,r=e[n]._c,l=e('<a class="'+r.title+'" />').appendTo(i),d=function(e){if(e=e||this.$pnls.children("."+r.current),!e.hasClass(r.vertical)){var n=e.find("."+this.conf.classNames[t].panelTitle);n.length||(n=e.children("."+r.navbar).children("."+r.title)),a=n.attr("href"),o=n.html()||s.title,l[a?"attr":"removeAttr"]("href",a),l[a||o?"removeClass":"addClass"](r.hidden),l.html(o)}};return this.bind("openPanel",d),this.bind("initPanels",function(e){d.call(this)}),0},e[n].configuration.classNames[t].panelTitle="Title"}(jQuery),/*	
 * jQuery mmenu RTL add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="rtl";e[n].addons[t]={setup:function(){var s=this.opts[t];this.conf[t];o=e[n].glbl,"object"!=typeof s&&(s={use:s}),s=this.opts[t]=e.extend(!0,{},e[n].defaults[t],s),"boolean"!=typeof s.use&&(s.use="rtl"==(o.$html.attr("dir")||"").toLowerCase()),s.use&&this.$menu.addClass(i.rtl)},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("rtl")},clickAnchor:function(e,n){}},e[n].defaults[t]={use:"detect"};var i,s,a,o}(jQuery),/*
 * jQuery mmenu screenReader add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){function n(e,n,t){e.prop("aria-"+n,t)[t?"attr":"removeAttr"]("aria-"+n,t)}function t(e){return'<span class="'+a.sronly+'">'+e+"</span>"}var i="mmenu",s="screenReader";e[i].addons[s]={setup:function(){var o=this.opts[s],r=this.conf[s];if(l=e[i].glbl,"boolean"==typeof o&&(o={aria:o,text:o}),"object"!=typeof o&&(o={}),o=this.opts[s]=e.extend(!0,{},e[i].defaults[s],o),o.aria){if(this.opts.offCanvas){var d=function(){n(this.$menu,"hidden",!1)},c=function(){n(this.$menu,"hidden",!0)};this.bind("open",d),this.bind("close",c),n(this.$menu,"hidden",!0)}var h=function(){},u=function(e){var t=this.$menu.children("."+a.navbar),i=t.children("."+a.prev),s=t.children("."+a.next),r=t.children("."+a.title);n(i,"hidden",i.is("."+a.hidden)),n(s,"hidden",s.is("."+a.hidden)),o.text&&n(r,"hidden",!i.is("."+a.hidden)),n(this.$pnls.children("."+a.panel).not(e),"hidden",!0),n(e,"hidden",!1)};this.bind("update",h),this.bind("openPanel",h),this.bind("openPanel",u);var f=function(t){var i;t=t||this.$menu;var s=t.children("."+a.navbar),r=s.children("."+a.prev),l=s.children("."+a.next);s.children("."+a.title);n(r,"haspopup",!0),n(l,"haspopup",!0),i=t.is("."+a.panel)?t.find("."+a.prev+", ."+a.next):r.add(l),i.each(function(){n(e(this),"owns",e(this).attr("href").replace("#",""))}),o.text&&t.is("."+a.panel)&&(i=t.find("."+a.listview).find("."+a.fullsubopen).parent().children("span"),n(i,"hidden",!0))};this.bind("initPanels",f),this.bind("_initAddons",f)}if(o.text){var p=function(n){var s;n=n||this.$menu;var o=n.children("."+a.navbar);o.each(function(){var n=e(this),o=e[i].i18n(r.text.closeSubmenu);s=n.children("."+a.title),s.length&&(o+=" ("+s.text()+")"),n.children("."+a.prev).html(t(o))}),o.children("."+a.close).html(t(e[i].i18n(r.text.closeMenu))),n.is("."+a.panel)&&n.find("."+a.listview).children("li").children("."+a.next).each(function(){var n=e(this),o=e[i].i18n(r.text[n.parent().is("."+a.vertical)?"toggleSubmenu":"openSubmenu"]);s=n.nextAll("span, a").first(),s.length&&(o+=" ("+s.text()+")"),n.html(t(o))})};this.bind("initPanels",p),this.bind("_initAddons",p)}},add:function(){a=e[i]._c,o=e[i]._d,r=e[i]._e,a.add("sronly")},clickAnchor:function(e,n){}},e[i].defaults[s]={aria:!1,text:!1},e[i].configuration[s]={text:{closeMenu:"Close menu",closeSubmenu:"Close submenu",openSubmenu:"Open submenu",toggleSubmenu:"Toggle submenu"}};var a,o,r,l}(jQuery),/*	
 * jQuery mmenu searchfield add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){function n(e){switch(e){case 9:case 16:case 17:case 18:case 37:case 38:case 39:case 40:return!0}return!1}var t="mmenu",i="searchfield";e[t].addons[i]={setup:function(){var l=this,d=this.opts[i],c=this.conf[i];r=e[t].glbl,"boolean"==typeof d&&(d={add:d}),"object"!=typeof d&&(d={}),"boolean"==typeof d.resultsPanel&&(d.resultsPanel={add:d.resultsPanel}),d=this.opts[i]=e.extend(!0,{},e[t].defaults[i],d),c=this.conf[i]=e.extend(!0,{},e[t].configuration[i],c),this.bind("close",function(){this.$menu.find("."+s.search).find("input").blur()}),this.bind("initPanels",function(r){if(d.add){var h;switch(d.addTo){case"panels":h=r;break;default:h=this.$menu.find(d.addTo)}if(h.each(function(){var n=e(this);if(!n.is("."+s.panel)||!n.is("."+s.vertical)){if(!n.children("."+s.search).length){var i=l.__valueOrFn(c.clear,n),a=l.__valueOrFn(c.form,n),r=l.__valueOrFn(c.input,n),h=l.__valueOrFn(c.submit,n),u=e("<"+(a?"form":"div")+' class="'+s.search+'" />'),f=e('<input placeholder="'+e[t].i18n(d.placeholder)+'" type="text" autocomplete="off" />');u.append(f);var p;if(r)for(p in r)f.attr(p,r[p]);if(i&&e('<a class="'+s.btn+" "+s.clear+'" href="#" />').appendTo(u).on(o.click+"-searchfield",function(e){e.preventDefault(),f.val("").trigger(o.keyup+"-searchfield")}),a){for(p in a)u.attr(p,a[p]);h&&!i&&e('<a class="'+s.btn+" "+s.next+'" href="#" />').appendTo(u).on(o.click+"-searchfield",function(e){e.preventDefault(),u.submit()})}n.hasClass(s.search)?n.replaceWith(u):n.prepend(u).addClass(s.hassearch)}if(d.noResults){var v=n.closest("."+s.panel).length;if(v||(n=l.$pnls.children("."+s.panel).first()),!n.children("."+s.noresultsmsg).length){var m=n.children("."+s.listview).first();e('<div class="'+s.noresultsmsg+" "+s.hidden+'" />').append(e[t].i18n(d.noResults))[m.length?"insertAfter":"prependTo"](m.length?m:n)}}}}),d.search){if(d.resultsPanel.add){d.showSubPanels=!1;var u=this.$pnls.children("."+s.resultspanel);u.length||(u=e('<div class="'+s.panel+" "+s.resultspanel+" "+s.hidden+'" />').appendTo(this.$pnls).append('<div class="'+s.navbar+" "+s.hidden+'"><a class="'+s.title+'">'+e[t].i18n(d.resultsPanel.title)+"</a></div>").append('<ul class="'+s.listview+'" />').append(this.$pnls.find("."+s.noresultsmsg).first().clone()),this.initPanels(u))}this.$menu.find("."+s.search).each(function(){var t,r,c=e(this),h=c.closest("."+s.panel).length;h?(t=c.closest("."+s.panel),r=t):(t=e("."+s.panel,l.$menu),r=l.$menu),d.resultsPanel.add&&(t=t.not(u));var f=c.children("input"),p=l.__findAddBack(t,"."+s.listview).children("li"),v=p.filter("."+s.divider),m=l.__filterListItems(p),g="a",b=g+", span",_="",C=function(){var n=f.val().toLowerCase();if(n!=_){if(_=n,d.resultsPanel.add&&u.children("."+s.listview).empty(),t.scrollTop(0),m.add(v).addClass(s.hidden).find("."+s.fullsubopensearch).removeClass(s.fullsubopen+" "+s.fullsubopensearch),m.each(function(){var n=e(this),t=g;(d.showTextItems||d.showSubPanels&&n.find("."+s.next))&&(t=b);var i=n.data(a.searchtext)||n.children(t).text();i.toLowerCase().indexOf(_)>-1&&n.add(n.prevAll("."+s.divider).first()).removeClass(s.hidden)}),d.showSubPanels&&t.each(function(n){var t=e(this);l.__filterListItems(t.find("."+s.listview).children()).each(function(){var n=e(this),t=n.data(a.child);n.removeClass(s.nosubresults),t&&t.find("."+s.listview).children().removeClass(s.hidden)})}),d.resultsPanel.add)if(""===_)this.closeAllPanels(),this.openPanel(this.$pnls.children("."+s.subopened).last());else{var i=e();t.each(function(){var n=l.__filterListItems(e(this).find("."+s.listview).children()).not("."+s.hidden).clone(!0);n.length&&(d.resultsPanel.dividers&&(i=i.add('<li class="'+s.divider+'">'+e(this).children("."+s.navbar).text()+"</li>")),i=i.add(n))}),i.find("."+s.next).remove(),u.children("."+s.listview).append(i),this.openPanel(u)}else e(t.get().reverse()).each(function(n){var t=e(this),i=t.data(a.parent);i&&(l.__filterListItems(t.find("."+s.listview).children()).length?(i.hasClass(s.hidden)&&i.children("."+s.next).not("."+s.fullsubopen).addClass(s.fullsubopen).addClass(s.fullsubopensearch),i.removeClass(s.hidden).removeClass(s.nosubresults).prevAll("."+s.divider).first().removeClass(s.hidden)):h||(t.hasClass(s.opened)&&setTimeout(function(){l.openPanel(i.closest("."+s.panel))},(n+1)*(1.5*l.conf.openingInterval)),i.addClass(s.nosubresults)))});r.find("."+s.noresultsmsg)[m.not("."+s.hidden).length?"addClass":"removeClass"](s.hidden),this.update()}};f.off(o.keyup+"-"+i+" "+o.change+"-"+i).on(o.keyup+"-"+i,function(e){n(e.keyCode)||C.call(l)}).on(o.change+"-"+i,function(e){C.call(l)});var y=c.children("."+s.btn);y.length&&f.on(o.keyup+"-"+i,function(e){y[f.val().length?"removeClass":"addClass"](s.hidden)}),f.trigger(o.keyup+"-"+i)})}}})},add:function(){s=e[t]._c,a=e[t]._d,o=e[t]._e,s.add("clear search hassearch resultspanel noresultsmsg noresults nosubresults fullsubopensearch"),a.add("searchtext"),o.add("change keyup")},clickAnchor:function(e,n){}},e[t].defaults[i]={add:!1,addTo:"panels",placeholder:"Search",noResults:"No results found.",resultsPanel:{add:!1,dividers:!0,title:"Search results"},search:!0,showTextItems:!1,showSubPanels:!0},e[t].configuration[i]={clear:!1,form:!1,input:!1,submit:!1};var s,a,o,r}(jQuery),/*	
 * jQuery mmenu sectionIndexer add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="sectionIndexer";e[n].addons[t]={setup:function(){var s=this,r=this.opts[t];this.conf[t];o=e[n].glbl,"boolean"==typeof r&&(r={add:r}),"object"!=typeof r&&(r={}),r=this.opts[t]=e.extend(!0,{},e[n].defaults[t],r),this.bind("initPanels",function(n){if(r.add){var t;switch(r.addTo){case"panels":t=n;break;default:t=e(r.addTo,this.$menu).filter("."+i.panel)}t.find("."+i.divider).closest("."+i.panel).addClass(i.hasindexer)}if(!this.$indexer&&this.$pnls.children("."+i.hasindexer).length){this.$indexer=e('<div class="'+i.indexer+'" />').prependTo(this.$pnls).append('<a href="#a">a</a><a href="#b">b</a><a href="#c">c</a><a href="#d">d</a><a href="#e">e</a><a href="#f">f</a><a href="#g">g</a><a href="#h">h</a><a href="#i">i</a><a href="#j">j</a><a href="#k">k</a><a href="#l">l</a><a href="#m">m</a><a href="#n">n</a><a href="#o">o</a><a href="#p">p</a><a href="#q">q</a><a href="#r">r</a><a href="#s">s</a><a href="#t">t</a><a href="#u">u</a><a href="#v">v</a><a href="#w">w</a><a href="#x">x</a><a href="#y">y</a><a href="#z">z</a>'),this.$indexer.children().on(a.mouseover+"-sectionindexer "+i.touchstart+"-sectionindexer",function(n){var t=e(this).attr("href").slice(1),a=s.$pnls.children("."+i.current),o=a.find("."+i.listview),r=!1,l=a.scrollTop();a.scrollTop(0),o.children("."+i.divider).not("."+i.hidden).each(function(){r===!1&&t==e(this).text().slice(0,1).toLowerCase()&&(r=e(this).position().top)}),a.scrollTop(r!==!1?r:l)});var o=function(e){s.$menu[(e.hasClass(i.hasindexer)?"add":"remove")+"Class"](i.hasindexer)};this.bind("openPanel",o),o.call(this,this.$pnls.children("."+i.current))}})},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("indexer hasindexer"),a.add("mouseover touchstart")},clickAnchor:function(e,n){if(e.parent().is("."+i.indexer))return!0}},e[n].defaults[t]={add:!1,addTo:"panels"};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu setSelected add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="setSelected";e[n].addons[t]={setup:function(){var a=this,r=this.opts[t];this.conf[t];if(o=e[n].glbl,"boolean"==typeof r&&(r={hover:r,parent:r}),"object"!=typeof r&&(r={}),r=this.opts[t]=e.extend(!0,{},e[n].defaults[t],r),"detect"==r.current){var l=function(e){e=e.split("?")[0].split("#")[0];var n=a.$menu.find('a[href="'+e+'"], a[href="'+e+'/"]');n.length?a.setSelected(n.parent(),!0):(e=e.split("/").slice(0,-1),e.length&&l(e.join("/")))};l(window.location.href)}else r.current||this.bind("initPanels",function(e){e.find("."+i.listview).children("."+i.selected).removeClass(i.selected)});if(r.hover&&this.$menu.addClass(i.hoverselected),r.parent){this.$menu.addClass(i.parentselected);var d=function(e){this.$pnls.find("."+i.listview).find("."+i.next).removeClass(i.selected);for(var n=e.data(s.parent);n&&n.length;)n=n.not("."+i.vertical).children("."+i.next).addClass(i.selected).end().closest("."+i.panel).data(s.parent)};this.bind("openedPanel",d),this.bind("initPanels",function(e){d.call(this,this.$pnls.children("."+i.current))})}},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("hoverselected parentselected")},clickAnchor:function(e,n){}},e[n].defaults[t]={current:!0,hover:!1,parent:!1};var i,s,a,o}(jQuery),/*	
 * jQuery mmenu toggles add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
function(e){var n="mmenu",t="toggles";e[n].addons[t]={setup:function(){var s=this;this.opts[t],this.conf[t];o=e[n].glbl,this.bind("initPanels",function(n){this.__refactorClass(e("input",n),this.conf.classNames[t].toggle,"toggle"),this.__refactorClass(e("input",n),this.conf.classNames[t].check,"check"),e("input."+i.toggle+", input."+i.check,n).each(function(){var n=e(this),t=n.closest("li"),a=n.hasClass(i.toggle)?"toggle":"check",o=n.attr("id")||s.__getUniqueId();t.children('label[for="'+o+'"]').length||(n.attr("id",o),t.prepend(n),e('<label for="'+o+'" class="'+i[a]+'"></label>').insertBefore(t.children("a, span").last()))})})},add:function(){i=e[n]._c,s=e[n]._d,a=e[n]._e,i.add("toggle check")},clickAnchor:function(e,n){}},e[n].configuration.classNames[t]={toggle:"Toggle",check:"Check"};var i,s,a,o}(jQuery);
;/*	
 * jQuery mmenu fixedElements add-on
 * mmenu.frebsite.nl
 *
 * Copyright (c) Fred Heusschen
 */
!function(s){var i="mmenu",t="fixedElements";s[i].addons[t]={setup:function(){if(this.opts.offCanvas){var n=this.opts[t];this.conf[t];d=s[i].glbl,n=this.opts[t]=s.extend(!0,{},s[i].defaults[t],n);var a=function(s){var i=this.conf.classNames[t].fixed;this.__refactorClass(s.find("."+i),i,"slideout").appendTo(d.$body)};a.call(this,d.$page),this.bind("setPage",a)}},add:function(){n=s[i]._c,a=s[i]._d,e=s[i]._e,n.add("fixed")},clickAnchor:function(s,i){}},s[i].configuration.classNames[t]={fixed:"Fixed"};var n,a,e,d}(jQuery);
;/**
* jquery-match-height master by @liabru
* http://brm.io/jquery-match-height/
* License: MIT
*/

;(function(factory) { // eslint-disable-line no-extra-semi
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery'], factory);
    } else if (typeof module !== 'undefined' && module.exports) {
        // CommonJS
        module.exports = factory(require('jquery'));
    } else {
        // Global
        factory(jQuery);
    }
})(function($) {
    /*
    *  internal
    */

    var _previousResizeWidth = -1,
        _updateTimeout = -1;

    /*
    *  _parse
    *  value parse utility function
    */

    var _parse = function(value) {
        // parse value and convert NaN to 0
        return parseFloat(value) || 0;
    };

    /*
    *  _rows
    *  utility function returns array of jQuery selections representing each row
    *  (as displayed after float wrapping applied by browser)
    */

    var _rows = function(elements) {
        var tolerance = 1,
            $elements = $(elements),
            lastTop = null,
            rows = [];

        // group elements by their top position
        $elements.each(function(){
            var $that = $(this),
                top = $that.offset().top - _parse($that.css('margin-top')),
                lastRow = rows.length > 0 ? rows[rows.length - 1] : null;

            if (lastRow === null) {
                // first item on the row, so just push it
                rows.push($that);
            } else {
                // if the row top is the same, add to the row group
                if (Math.floor(Math.abs(lastTop - top)) <= tolerance) {
                    rows[rows.length - 1] = lastRow.add($that);
                } else {
                    // otherwise start a new row group
                    rows.push($that);
                }
            }

            // keep track of the last row top
            lastTop = top;
        });

        return rows;
    };

    /*
    *  _parseOptions
    *  handle plugin options
    */

    var _parseOptions = function(options) {
        var opts = {
            byRow: true,
            property: 'height',
            target: null,
            remove: false
        };

        if (typeof options === 'object') {
            return $.extend(opts, options);
        }

        if (typeof options === 'boolean') {
            opts.byRow = options;
        } else if (options === 'remove') {
            opts.remove = true;
        }

        return opts;
    };

    /*
    *  matchHeight
    *  plugin definition
    */

    var matchHeight = $.fn.matchHeight = function(options) {
        var opts = _parseOptions(options);

        // handle remove
        if (opts.remove) {
            var that = this;

            // remove fixed height from all selected elements
            this.css(opts.property, '');

            // remove selected elements from all groups
            $.each(matchHeight._groups, function(key, group) {
                group.elements = group.elements.not(that);
            });

            // TODO: cleanup empty groups

            return this;
        }

        if (this.length <= 1 && !opts.target) {
            return this;
        }

        // keep track of this group so we can re-apply later on load and resize events
        matchHeight._groups.push({
            elements: this,
            options: opts
        });

        // match each element's height to the tallest element in the selection
        matchHeight._apply(this, opts);

        return this;
    };

    /*
    *  plugin global options
    */

    matchHeight.version = 'master';
    matchHeight._groups = [];
    matchHeight._throttle = 80;
    matchHeight._maintainScroll = false;
    matchHeight._beforeUpdate = null;
    matchHeight._afterUpdate = null;
    matchHeight._rows = _rows;
    matchHeight._parse = _parse;
    matchHeight._parseOptions = _parseOptions;

    /*
    *  matchHeight._apply
    *  apply matchHeight to given elements
    */

    matchHeight._apply = function(elements, options) {
        var opts = _parseOptions(options),
            $elements = $(elements),
            rows = [$elements];

        // take note of scroll position
        var scrollTop = $(window).scrollTop(),
            htmlHeight = $('html').outerHeight(true);

        // get hidden parents
        var $hiddenParents = $elements.parents().filter(':hidden');

        // cache the original inline style
        $hiddenParents.each(function() {
            var $that = $(this);
            $that.data('style-cache', $that.attr('style'));
        });

        // temporarily must force hidden parents visible
        $hiddenParents.css('display', 'block');

        // get rows if using byRow, otherwise assume one row
        if (opts.byRow && !opts.target) {

            // must first force an arbitrary equal height so floating elements break evenly
            $elements.each(function() {
                var $that = $(this),
                    display = $that.css('display');

                // temporarily force a usable display value
                if (display !== 'inline-block' && display !== 'flex' && display !== 'inline-flex') {
                    display = 'block';
                }

                // cache the original inline style
                $that.data('style-cache', $that.attr('style'));

                $that.css({
                    'display': display,
                    'padding-top': '0',
                    'padding-bottom': '0',
                    'margin-top': '0',
                    'margin-bottom': '0',
                    'border-top-width': '0',
                    'border-bottom-width': '0',
                    'height': '100px',
                    'overflow': 'hidden'
                });
            });

            // get the array of rows (based on element top position)
            rows = _rows($elements);

            // revert original inline styles
            $elements.each(function() {
                var $that = $(this);
                $that.attr('style', $that.data('style-cache') || '');
            });
        }

        $.each(rows, function(key, row) {
            var $row = $(row),
                targetHeight = 0;

            if (!opts.target) {
                // skip apply to rows with only one item
                if (opts.byRow && $row.length <= 1) {
                    $row.css(opts.property, '');
                    return;
                }

                // iterate the row and find the max height
                $row.each(function(){
                    var $that = $(this),
                        style = $that.attr('style'),
                        display = $that.css('display');

                    // temporarily force a usable display value
                    if (display !== 'inline-block' && display !== 'flex' && display !== 'inline-flex') {
                        display = 'block';
                    }

                    // ensure we get the correct actual height (and not a previously set height value)
                    var css = { 'display': display };
                    css[opts.property] = '';
                    $that.css(css);

                    // find the max height (including padding, but not margin)
                    if ($that.outerHeight(false) > targetHeight) {
                        targetHeight = $that.outerHeight(false);
                    }

                    // revert styles
                    if (style) {
                        $that.attr('style', style);
                    } else {
                        $that.css('display', '');
                    }
                });
            } else {
                // if target set, use the height of the target element
                targetHeight = opts.target.outerHeight(false);
            }

            // iterate the row and apply the height to all elements
            $row.each(function(){
                var $that = $(this),
                    verticalPadding = 0;

                // don't apply to a target
                if (opts.target && $that.is(opts.target)) {
                    return;
                }

                // handle padding and border correctly (required when not using border-box)
                if ($that.css('box-sizing') !== 'border-box') {
                    verticalPadding += _parse($that.css('border-top-width')) + _parse($that.css('border-bottom-width'));
                    verticalPadding += _parse($that.css('padding-top')) + _parse($that.css('padding-bottom'));
                }

                // set the height (accounting for padding and border)
                $that.css(opts.property, (targetHeight - verticalPadding) + 'px');
            });
        });

        // revert hidden parents
        $hiddenParents.each(function() {
            var $that = $(this);
            $that.attr('style', $that.data('style-cache') || null);
        });

        // restore scroll position if enabled
        if (matchHeight._maintainScroll) {
            $(window).scrollTop((scrollTop / htmlHeight) * $('html').outerHeight(true));
        }

        return this;
    };

    /*
    *  matchHeight._applyDataApi
    *  applies matchHeight to all elements with a data-match-height attribute
    */

    matchHeight._applyDataApi = function() {
        var groups = {};

        // generate groups by their groupId set by elements using data-match-height
        $('[data-match-height], [data-mh]').each(function() {
            var $this = $(this),
                groupId = $this.attr('data-mh') || $this.attr('data-match-height');

            if (groupId in groups) {
                groups[groupId] = groups[groupId].add($this);
            } else {
                groups[groupId] = $this;
            }
        });

        // apply matchHeight to each group
        $.each(groups, function() {
            this.matchHeight(true);
        });
    };

    /*
    *  matchHeight._update
    *  updates matchHeight on all current groups with their correct options
    */

    var _update = function(event) {
        if (matchHeight._beforeUpdate) {
            matchHeight._beforeUpdate(event, matchHeight._groups);
        }

        $.each(matchHeight._groups, function() {
            matchHeight._apply(this.elements, this.options);
        });

        if (matchHeight._afterUpdate) {
            matchHeight._afterUpdate(event, matchHeight._groups);
        }
    };

    matchHeight._update = function(throttle, event) {
        // prevent update if fired from a resize event
        // where the viewport width hasn't actually changed
        // fixes an event looping bug in IE8
        if (event && event.type === 'resize') {
            var windowWidth = $(window).width();
            if (windowWidth === _previousResizeWidth) {
                return;
            }
            _previousResizeWidth = windowWidth;
        }

        // throttle updates
        if (!throttle) {
            _update(event);
        } else if (_updateTimeout === -1) {
            _updateTimeout = setTimeout(function() {
                _update(event);
                _updateTimeout = -1;
            }, matchHeight._throttle);
        }
    };

    /*
    *  bind events
    */

    // apply on DOM ready event
    $(matchHeight._applyDataApi);

    // use on or bind where supported
    var on = $.fn.on ? 'on' : 'bind';

    // update heights on load and resize events
    $(window)[on]('load', function(event) {
        matchHeight._update(false, event);
    });

    // throttled update heights on resize events
    $(window)[on]('resize orientationchange', function(event) {
        matchHeight._update(true, event);
    });

});

;/* Web Font Loader v1.6.28 - (c) Adobe Systems, Google. License: Apache 2.0 */(function(){function aa(a,b,c){return a.call.apply(a.bind,arguments)}function ba(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}}function p(a,b,c){p=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?aa:ba;return p.apply(null,arguments)}var q=Date.now||function(){return+new Date};function ca(a,b){this.a=a;this.o=b||a;this.c=this.o.document}var da=!!window.FontFace;function t(a,b,c,d){b=a.c.createElement(b);if(c)for(var e in c)c.hasOwnProperty(e)&&("style"==e?b.style.cssText=c[e]:b.setAttribute(e,c[e]));d&&b.appendChild(a.c.createTextNode(d));return b}function u(a,b,c){a=a.c.getElementsByTagName(b)[0];a||(a=document.documentElement);a.insertBefore(c,a.lastChild)}function v(a){a.parentNode&&a.parentNode.removeChild(a)}
function w(a,b,c){b=b||[];c=c||[];for(var d=a.className.split(/\s+/),e=0;e<b.length;e+=1){for(var f=!1,g=0;g<d.length;g+=1)if(b[e]===d[g]){f=!0;break}f||d.push(b[e])}b=[];for(e=0;e<d.length;e+=1){f=!1;for(g=0;g<c.length;g+=1)if(d[e]===c[g]){f=!0;break}f||b.push(d[e])}a.className=b.join(" ").replace(/\s+/g," ").replace(/^\s+|\s+$/,"")}function y(a,b){for(var c=a.className.split(/\s+/),d=0,e=c.length;d<e;d++)if(c[d]==b)return!0;return!1}
function ea(a){return a.o.location.hostname||a.a.location.hostname}function z(a,b,c){function d(){m&&e&&f&&(m(g),m=null)}b=t(a,"link",{rel:"stylesheet",href:b,media:"all"});var e=!1,f=!0,g=null,m=c||null;da?(b.onload=function(){e=!0;d()},b.onerror=function(){e=!0;g=Error("Stylesheet failed to load");d()}):setTimeout(function(){e=!0;d()},0);u(a,"head",b)}
function A(a,b,c,d){var e=a.c.getElementsByTagName("head")[0];if(e){var f=t(a,"script",{src:b}),g=!1;f.onload=f.onreadystatechange=function(){g||this.readyState&&"loaded"!=this.readyState&&"complete"!=this.readyState||(g=!0,c&&c(null),f.onload=f.onreadystatechange=null,"HEAD"==f.parentNode.tagName&&e.removeChild(f))};e.appendChild(f);setTimeout(function(){g||(g=!0,c&&c(Error("Script load timeout")))},d||5E3);return f}return null};function B(){this.a=0;this.c=null}function C(a){a.a++;return function(){a.a--;D(a)}}function E(a,b){a.c=b;D(a)}function D(a){0==a.a&&a.c&&(a.c(),a.c=null)};function F(a){this.a=a||"-"}F.prototype.c=function(a){for(var b=[],c=0;c<arguments.length;c++)b.push(arguments[c].replace(/[\W_]+/g,"").toLowerCase());return b.join(this.a)};function G(a,b){this.c=a;this.f=4;this.a="n";var c=(b||"n4").match(/^([nio])([1-9])$/i);c&&(this.a=c[1],this.f=parseInt(c[2],10))}function fa(a){return H(a)+" "+(a.f+"00")+" 300px "+I(a.c)}function I(a){var b=[];a=a.split(/,\s*/);for(var c=0;c<a.length;c++){var d=a[c].replace(/['"]/g,"");-1!=d.indexOf(" ")||/^\d/.test(d)?b.push("'"+d+"'"):b.push(d)}return b.join(",")}function J(a){return a.a+a.f}function H(a){var b="normal";"o"===a.a?b="oblique":"i"===a.a&&(b="italic");return b}
function ga(a){var b=4,c="n",d=null;a&&((d=a.match(/(normal|oblique|italic)/i))&&d[1]&&(c=d[1].substr(0,1).toLowerCase()),(d=a.match(/([1-9]00|normal|bold)/i))&&d[1]&&(/bold/i.test(d[1])?b=7:/[1-9]00/.test(d[1])&&(b=parseInt(d[1].substr(0,1),10))));return c+b};function ha(a,b){this.c=a;this.f=a.o.document.documentElement;this.h=b;this.a=new F("-");this.j=!1!==b.events;this.g=!1!==b.classes}function ia(a){a.g&&w(a.f,[a.a.c("wf","loading")]);K(a,"loading")}function L(a){if(a.g){var b=y(a.f,a.a.c("wf","active")),c=[],d=[a.a.c("wf","loading")];b||c.push(a.a.c("wf","inactive"));w(a.f,c,d)}K(a,"inactive")}function K(a,b,c){if(a.j&&a.h[b])if(c)a.h[b](c.c,J(c));else a.h[b]()};function ja(){this.c={}}function ka(a,b,c){var d=[],e;for(e in b)if(b.hasOwnProperty(e)){var f=a.c[e];f&&d.push(f(b[e],c))}return d};function M(a,b){this.c=a;this.f=b;this.a=t(this.c,"span",{"aria-hidden":"true"},this.f)}function N(a){u(a.c,"body",a.a)}function O(a){return"display:block;position:absolute;top:-9999px;left:-9999px;font-size:300px;width:auto;height:auto;line-height:normal;margin:0;padding:0;font-variant:normal;white-space:nowrap;font-family:"+I(a.c)+";"+("font-style:"+H(a)+";font-weight:"+(a.f+"00")+";")};function P(a,b,c,d,e,f){this.g=a;this.j=b;this.a=d;this.c=c;this.f=e||3E3;this.h=f||void 0}P.prototype.start=function(){var a=this.c.o.document,b=this,c=q(),d=new Promise(function(d,e){function f(){q()-c>=b.f?e():a.fonts.load(fa(b.a),b.h).then(function(a){1<=a.length?d():setTimeout(f,25)},function(){e()})}f()}),e=null,f=new Promise(function(a,d){e=setTimeout(d,b.f)});Promise.race([f,d]).then(function(){e&&(clearTimeout(e),e=null);b.g(b.a)},function(){b.j(b.a)})};function Q(a,b,c,d,e,f,g){this.v=a;this.B=b;this.c=c;this.a=d;this.s=g||"BESbswy";this.f={};this.w=e||3E3;this.u=f||null;this.m=this.j=this.h=this.g=null;this.g=new M(this.c,this.s);this.h=new M(this.c,this.s);this.j=new M(this.c,this.s);this.m=new M(this.c,this.s);a=new G(this.a.c+",serif",J(this.a));a=O(a);this.g.a.style.cssText=a;a=new G(this.a.c+",sans-serif",J(this.a));a=O(a);this.h.a.style.cssText=a;a=new G("serif",J(this.a));a=O(a);this.j.a.style.cssText=a;a=new G("sans-serif",J(this.a));a=
O(a);this.m.a.style.cssText=a;N(this.g);N(this.h);N(this.j);N(this.m)}var R={D:"serif",C:"sans-serif"},S=null;function T(){if(null===S){var a=/AppleWebKit\/([0-9]+)(?:\.([0-9]+))/.exec(window.navigator.userAgent);S=!!a&&(536>parseInt(a[1],10)||536===parseInt(a[1],10)&&11>=parseInt(a[2],10))}return S}Q.prototype.start=function(){this.f.serif=this.j.a.offsetWidth;this.f["sans-serif"]=this.m.a.offsetWidth;this.A=q();U(this)};
function la(a,b,c){for(var d in R)if(R.hasOwnProperty(d)&&b===a.f[R[d]]&&c===a.f[R[d]])return!0;return!1}function U(a){var b=a.g.a.offsetWidth,c=a.h.a.offsetWidth,d;(d=b===a.f.serif&&c===a.f["sans-serif"])||(d=T()&&la(a,b,c));d?q()-a.A>=a.w?T()&&la(a,b,c)&&(null===a.u||a.u.hasOwnProperty(a.a.c))?V(a,a.v):V(a,a.B):ma(a):V(a,a.v)}function ma(a){setTimeout(p(function(){U(this)},a),50)}function V(a,b){setTimeout(p(function(){v(this.g.a);v(this.h.a);v(this.j.a);v(this.m.a);b(this.a)},a),0)};function W(a,b,c){this.c=a;this.a=b;this.f=0;this.m=this.j=!1;this.s=c}var X=null;W.prototype.g=function(a){var b=this.a;b.g&&w(b.f,[b.a.c("wf",a.c,J(a).toString(),"active")],[b.a.c("wf",a.c,J(a).toString(),"loading"),b.a.c("wf",a.c,J(a).toString(),"inactive")]);K(b,"fontactive",a);this.m=!0;na(this)};
W.prototype.h=function(a){var b=this.a;if(b.g){var c=y(b.f,b.a.c("wf",a.c,J(a).toString(),"active")),d=[],e=[b.a.c("wf",a.c,J(a).toString(),"loading")];c||d.push(b.a.c("wf",a.c,J(a).toString(),"inactive"));w(b.f,d,e)}K(b,"fontinactive",a);na(this)};function na(a){0==--a.f&&a.j&&(a.m?(a=a.a,a.g&&w(a.f,[a.a.c("wf","active")],[a.a.c("wf","loading"),a.a.c("wf","inactive")]),K(a,"active")):L(a.a))};function oa(a){this.j=a;this.a=new ja;this.h=0;this.f=this.g=!0}oa.prototype.load=function(a){this.c=new ca(this.j,a.context||this.j);this.g=!1!==a.events;this.f=!1!==a.classes;pa(this,new ha(this.c,a),a)};
function qa(a,b,c,d,e){var f=0==--a.h;(a.f||a.g)&&setTimeout(function(){var a=e||null,m=d||null||{};if(0===c.length&&f)L(b.a);else{b.f+=c.length;f&&(b.j=f);var h,l=[];for(h=0;h<c.length;h++){var k=c[h],n=m[k.c],r=b.a,x=k;r.g&&w(r.f,[r.a.c("wf",x.c,J(x).toString(),"loading")]);K(r,"fontloading",x);r=null;if(null===X)if(window.FontFace){var x=/Gecko.*Firefox\/(\d+)/.exec(window.navigator.userAgent),xa=/OS X.*Version\/10\..*Safari/.exec(window.navigator.userAgent)&&/Apple/.exec(window.navigator.vendor);
X=x?42<parseInt(x[1],10):xa?!1:!0}else X=!1;X?r=new P(p(b.g,b),p(b.h,b),b.c,k,b.s,n):r=new Q(p(b.g,b),p(b.h,b),b.c,k,b.s,a,n);l.push(r)}for(h=0;h<l.length;h++)l[h].start()}},0)}function pa(a,b,c){var d=[],e=c.timeout;ia(b);var d=ka(a.a,c,a.c),f=new W(a.c,b,e);a.h=d.length;b=0;for(c=d.length;b<c;b++)d[b].load(function(b,d,c){qa(a,f,b,d,c)})};function ra(a,b){this.c=a;this.a=b}
ra.prototype.load=function(a){function b(){if(f["__mti_fntLst"+d]){var c=f["__mti_fntLst"+d](),e=[],h;if(c)for(var l=0;l<c.length;l++){var k=c[l].fontfamily;void 0!=c[l].fontStyle&&void 0!=c[l].fontWeight?(h=c[l].fontStyle+c[l].fontWeight,e.push(new G(k,h))):e.push(new G(k))}a(e)}else setTimeout(function(){b()},50)}var c=this,d=c.a.projectId,e=c.a.version;if(d){var f=c.c.o;A(this.c,(c.a.api||"https://fast.fonts.net/jsapi")+"/"+d+".js"+(e?"?v="+e:""),function(e){e?a([]):(f["__MonotypeConfiguration__"+
d]=function(){return c.a},b())}).id="__MonotypeAPIScript__"+d}else a([])};function sa(a,b){this.c=a;this.a=b}sa.prototype.load=function(a){var b,c,d=this.a.urls||[],e=this.a.families||[],f=this.a.testStrings||{},g=new B;b=0;for(c=d.length;b<c;b++)z(this.c,d[b],C(g));var m=[];b=0;for(c=e.length;b<c;b++)if(d=e[b].split(":"),d[1])for(var h=d[1].split(","),l=0;l<h.length;l+=1)m.push(new G(d[0],h[l]));else m.push(new G(d[0]));E(g,function(){a(m,f)})};function ta(a,b){a?this.c=a:this.c=ua;this.a=[];this.f=[];this.g=b||""}var ua="https://fonts.googleapis.com/css";function va(a,b){for(var c=b.length,d=0;d<c;d++){var e=b[d].split(":");3==e.length&&a.f.push(e.pop());var f="";2==e.length&&""!=e[1]&&(f=":");a.a.push(e.join(f))}}
function wa(a){if(0==a.a.length)throw Error("No fonts to load!");if(-1!=a.c.indexOf("kit="))return a.c;for(var b=a.a.length,c=[],d=0;d<b;d++)c.push(a.a[d].replace(/ /g,"+"));b=a.c+"?family="+c.join("%7C");0<a.f.length&&(b+="&subset="+a.f.join(","));0<a.g.length&&(b+="&text="+encodeURIComponent(a.g));return b};function ya(a){this.f=a;this.a=[];this.c={}}
var za={latin:"BESbswy","latin-ext":"\u00e7\u00f6\u00fc\u011f\u015f",cyrillic:"\u0439\u044f\u0416",greek:"\u03b1\u03b2\u03a3",khmer:"\u1780\u1781\u1782",Hanuman:"\u1780\u1781\u1782"},Aa={thin:"1",extralight:"2","extra-light":"2",ultralight:"2","ultra-light":"2",light:"3",regular:"4",book:"4",medium:"5","semi-bold":"6",semibold:"6","demi-bold":"6",demibold:"6",bold:"7","extra-bold":"8",extrabold:"8","ultra-bold":"8",ultrabold:"8",black:"9",heavy:"9",l:"3",r:"4",b:"7"},Ba={i:"i",italic:"i",n:"n",normal:"n"},
Ca=/^(thin|(?:(?:extra|ultra)-?)?light|regular|book|medium|(?:(?:semi|demi|extra|ultra)-?)?bold|black|heavy|l|r|b|[1-9]00)?(n|i|normal|italic)?$/;
function Da(a){for(var b=a.f.length,c=0;c<b;c++){var d=a.f[c].split(":"),e=d[0].replace(/\+/g," "),f=["n4"];if(2<=d.length){var g;var m=d[1];g=[];if(m)for(var m=m.split(","),h=m.length,l=0;l<h;l++){var k;k=m[l];if(k.match(/^[\w-]+$/)){var n=Ca.exec(k.toLowerCase());if(null==n)k="";else{k=n[2];k=null==k||""==k?"n":Ba[k];n=n[1];if(null==n||""==n)n="4";else var r=Aa[n],n=r?r:isNaN(n)?"4":n.substr(0,1);k=[k,n].join("")}}else k="";k&&g.push(k)}0<g.length&&(f=g);3==d.length&&(d=d[2],g=[],d=d?d.split(","):
g,0<d.length&&(d=za[d[0]])&&(a.c[e]=d))}a.c[e]||(d=za[e])&&(a.c[e]=d);for(d=0;d<f.length;d+=1)a.a.push(new G(e,f[d]))}};function Ea(a,b){this.c=a;this.a=b}var Fa={Arimo:!0,Cousine:!0,Tinos:!0};Ea.prototype.load=function(a){var b=new B,c=this.c,d=new ta(this.a.api,this.a.text),e=this.a.families;va(d,e);var f=new ya(e);Da(f);z(c,wa(d),C(b));E(b,function(){a(f.a,f.c,Fa)})};function Ga(a,b){this.c=a;this.a=b}Ga.prototype.load=function(a){var b=this.a.id,c=this.c.o;b?A(this.c,(this.a.api||"https://use.typekit.net")+"/"+b+".js",function(b){if(b)a([]);else if(c.Typekit&&c.Typekit.config&&c.Typekit.config.fn){b=c.Typekit.config.fn;for(var e=[],f=0;f<b.length;f+=2)for(var g=b[f],m=b[f+1],h=0;h<m.length;h++)e.push(new G(g,m[h]));try{c.Typekit.load({events:!1,classes:!1,async:!0})}catch(l){}a(e)}},2E3):a([])};function Ha(a,b){this.c=a;this.f=b;this.a=[]}Ha.prototype.load=function(a){var b=this.f.id,c=this.c.o,d=this;b?(c.__webfontfontdeckmodule__||(c.__webfontfontdeckmodule__={}),c.__webfontfontdeckmodule__[b]=function(b,c){for(var g=0,m=c.fonts.length;g<m;++g){var h=c.fonts[g];d.a.push(new G(h.name,ga("font-weight:"+h.weight+";font-style:"+h.style)))}a(d.a)},A(this.c,(this.f.api||"https://f.fontdeck.com/s/css/js/")+ea(this.c)+"/"+b+".js",function(b){b&&a([])})):a([])};var Y=new oa(window);Y.a.c.custom=function(a,b){return new sa(b,a)};Y.a.c.fontdeck=function(a,b){return new Ha(b,a)};Y.a.c.monotype=function(a,b){return new ra(b,a)};Y.a.c.typekit=function(a,b){return new Ga(b,a)};Y.a.c.google=function(a,b){return new Ea(b,a)};var Z={load:p(Y.load,Y)};"function"===typeof define&&define.amd?define(function(){return Z}):"undefined"!==typeof module&&module.exports?module.exports=Z:(window.WebFont=Z,window.WebFontConfig&&Y.load(window.WebFontConfig));}());

;function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0): collapse.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */
var Collapse = function ($) {
  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */
  var NAME = 'collapse';
  var VERSION = '4.0.0';
  var DATA_KEY = 'bs.collapse';
  var EVENT_KEY = "." + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 600;
  var Default = {
    toggle: true,
    parent: ''
  };
  var DefaultType = {
    toggle: 'boolean',
    parent: '(string|element)'
  };
  var Event = {
    SHOW: "show" + EVENT_KEY,
    SHOWN: "shown" + EVENT_KEY,
    HIDE: "hide" + EVENT_KEY,
    HIDDEN: "hidden" + EVENT_KEY,
    CLICK_DATA_API: "click" + EVENT_KEY + DATA_API_KEY
  };
  var ClassName = {
    SHOW: 'show',
    COLLAPSE: 'collapse',
    COLLAPSING: 'collapsing',
    COLLAPSED: 'collapsed'
  };
  var Dimension = {
    WIDTH: 'width',
    HEIGHT: 'height'
  };
  var Selector = {
    ACTIVES: '.show, .collapsing',
    DATA_TOGGLE: '[data-toggle="collapse"]'
    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };

  var Collapse =
  /*#__PURE__*/
  function () {
    function Collapse(element, config) {
      this._isTransitioning = false;
      this._element = element;
      this._config = this._getConfig(config);
      this._triggerArray = $.makeArray($("[data-toggle=\"collapse\"][href=\"#" + element.id + "\"]," + ("[data-toggle=\"collapse\"][data-target=\"#" + element.id + "\"]")));
      var tabToggles = $(Selector.DATA_TOGGLE);

      for (var i = 0; i < tabToggles.length; i++) {
        var elem = tabToggles[i];
        var selector = Util.getSelectorFromElement(elem);

        if (selector !== null && $(selector).filter(element).length > 0) {
          this._selector = selector;

          this._triggerArray.push(elem);
        }
      }

      this._parent = this._config.parent ? this._getParent() : null;

      if (!this._config.parent) {
        this._addAriaAndCollapsedClass(this._element, this._triggerArray);
      }

      if (this._config.toggle) {
        this.toggle();
      }
    } // Getters


    var _proto = Collapse.prototype;

    // Public
    _proto.toggle = function toggle() {
      if ($(this._element).hasClass(ClassName.SHOW)) {
        this.hide();
      } else {
        this.show();
      }
    };

    _proto.show = function show() {
      var _this = this;

      if (this._isTransitioning || $(this._element).hasClass(ClassName.SHOW)) {
        return;
      }

      var actives;
      var activesData;

      if (this._parent) {
        actives = $.makeArray($(this._parent).find(Selector.ACTIVES).filter("[data-parent=\"" + this._config.parent + "\"]"));

        if (actives.length === 0) {
          actives = null;
        }
      }

      if (actives) {
        activesData = $(actives).not(this._selector).data(DATA_KEY);

        if (activesData && activesData._isTransitioning) {
          return;
        }
      }

      var startEvent = $.Event(Event.SHOW);
      $(this._element).trigger(startEvent);

      if (startEvent.isDefaultPrevented()) {
        return;
      }

      if (actives) {
        Collapse._jQueryInterface.call($(actives).not(this._selector), 'hide');

        if (!activesData) {
          $(actives).data(DATA_KEY, null);
        }
      }

      var dimension = this._getDimension();

      $(this._element).removeClass(ClassName.COLLAPSE).addClass(ClassName.COLLAPSING);
      this._element.style[dimension] = 0;

      if (this._triggerArray.length > 0) {
        $(this._triggerArray).removeClass(ClassName.COLLAPSED).attr('aria-expanded', true);
      }

      this.setTransitioning(true);

      var complete = function complete() {
        $(_this._element).removeClass(ClassName.COLLAPSING).addClass(ClassName.COLLAPSE).addClass(ClassName.SHOW);
        _this._element.style[dimension] = '';

        _this.setTransitioning(false);

        $(_this._element).trigger(Event.SHOWN);
      };

      if (!Util.supportsTransitionEnd()) {
        complete();
        return;
      }

      var capitalizedDimension = dimension[0].toUpperCase() + dimension.slice(1);
      var scrollSize = "scroll" + capitalizedDimension;
      $(this._element).one(Util.TRANSITION_END, complete).emulateTransitionEnd(TRANSITION_DURATION);
      this._element.style[dimension] = this._element[scrollSize] + "px";
    };

    _proto.hide = function hide() {
      var _this2 = this;

      if (this._isTransitioning || !$(this._element).hasClass(ClassName.SHOW)) {
        return;
      }

      var startEvent = $.Event(Event.HIDE);
      $(this._element).trigger(startEvent);

      if (startEvent.isDefaultPrevented()) {
        return;
      }

      var dimension = this._getDimension();

      this._element.style[dimension] = this._element.getBoundingClientRect()[dimension] + "px";
      Util.reflow(this._element);
      $(this._element).addClass(ClassName.COLLAPSING).removeClass(ClassName.COLLAPSE).removeClass(ClassName.SHOW);

      if (this._triggerArray.length > 0) {
        for (var i = 0; i < this._triggerArray.length; i++) {
          var trigger = this._triggerArray[i];
          var selector = Util.getSelectorFromElement(trigger);

          if (selector !== null) {
            var $elem = $(selector);

            if (!$elem.hasClass(ClassName.SHOW)) {
              $(trigger).addClass(ClassName.COLLAPSED).attr('aria-expanded', false);
            }
          }
        }
      }

      this.setTransitioning(true);

      var complete = function complete() {
        _this2.setTransitioning(false);

        $(_this2._element).removeClass(ClassName.COLLAPSING).addClass(ClassName.COLLAPSE).trigger(Event.HIDDEN);
      };

      this._element.style[dimension] = '';

      if (!Util.supportsTransitionEnd()) {
        complete();
        return;
      }

      $(this._element).one(Util.TRANSITION_END, complete).emulateTransitionEnd(TRANSITION_DURATION);
    };

    _proto.setTransitioning = function setTransitioning(isTransitioning) {
      this._isTransitioning = isTransitioning;
    };

    _proto.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);
      this._config = null;
      this._parent = null;
      this._element = null;
      this._triggerArray = null;
      this._isTransitioning = null;
    }; // Private


    _proto._getConfig = function _getConfig(config) {
      config = _extends({}, Default, config);
      config.toggle = Boolean(config.toggle); // Coerce string values

      Util.typeCheckConfig(NAME, config, DefaultType);
      return config;
    };

    _proto._getDimension = function _getDimension() {
      var hasWidth = $(this._element).hasClass(Dimension.WIDTH);
      return hasWidth ? Dimension.WIDTH : Dimension.HEIGHT;
    };

    _proto._getParent = function _getParent() {
      var _this3 = this;

      var parent = null;

      if (Util.isElement(this._config.parent)) {
        parent = this._config.parent; // It's a jQuery object

        if (typeof this._config.parent.jquery !== 'undefined') {
          parent = this._config.parent[0];
        }
      } else {
        parent = $(this._config.parent)[0];
      }

      var selector = "[data-toggle=\"collapse\"][data-parent=\"" + this._config.parent + "\"]";
      $(parent).find(selector).each(function (i, element) {
        _this3._addAriaAndCollapsedClass(Collapse._getTargetFromElement(element), [element]);
      });
      return parent;
    };

    _proto._addAriaAndCollapsedClass = function _addAriaAndCollapsedClass(element, triggerArray) {
      if (element) {
        var isOpen = $(element).hasClass(ClassName.SHOW);

        if (triggerArray.length > 0) {
          $(triggerArray).toggleClass(ClassName.COLLAPSED, !isOpen).attr('aria-expanded', isOpen);
        }
      }
    }; // Static


    Collapse._getTargetFromElement = function _getTargetFromElement(element) {
      var selector = Util.getSelectorFromElement(element);
      return selector ? $(selector)[0] : null;
    };

    Collapse._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var $this = $(this);
        var data = $this.data(DATA_KEY);

        var _config = _extends({}, Default, $this.data(), typeof config === 'object' && config);

        if (!data && _config.toggle && /show|hide/.test(config)) {
          _config.toggle = false;
        }

        if (!data) {
          data = new Collapse(this, _config);
          $this.data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (typeof data[config] === 'undefined') {
            throw new TypeError("No method named \"" + config + "\"");
          }

          data[config]();
        }
      });
    };

    _createClass(Collapse, null, [{
      key: "VERSION",
      get: function get() {
        return VERSION;
      }
    }, {
      key: "Default",
      get: function get() {
        return Default;
      }
    }]);

    return Collapse;
  }();
  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */


  $(document).on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE, function (event) {
    // preventDefault only for <a> elements (which change the URL) not inside the collapsible element
    if (event.currentTarget.tagName === 'A') {
      event.preventDefault();
    }

    var $trigger = $(this);
    var selector = Util.getSelectorFromElement(this);
    $(selector).each(function () {
      var $target = $(this);
      var data = $target.data(DATA_KEY);
      var config = data ? 'toggle' : $trigger.data();

      Collapse._jQueryInterface.call($target, config);
    });
  });
  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Collapse._jQueryInterface;
  $.fn[NAME].Constructor = Collapse;

  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Collapse._jQueryInterface;
  };

  return Collapse;
}($);
//# sourceMappingURL=collapse.js.map
;function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0): dropdown.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */
var Dropdown = function ($) {
  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */
  var NAME = 'dropdown';
  var VERSION = '4.0.0';
  var DATA_KEY = 'bs.dropdown';
  var EVENT_KEY = "." + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var ESCAPE_KEYCODE = 27; // KeyboardEvent.which value for Escape (Esc) key

  var SPACE_KEYCODE = 32; // KeyboardEvent.which value for space key

  var TAB_KEYCODE = 9; // KeyboardEvent.which value for tab key

  var ARROW_UP_KEYCODE = 38; // KeyboardEvent.which value for up arrow key

  var ARROW_DOWN_KEYCODE = 40; // KeyboardEvent.which value for down arrow key

  var RIGHT_MOUSE_BUTTON_WHICH = 3; // MouseEvent.which value for the right button (assuming a right-handed mouse)

  var REGEXP_KEYDOWN = new RegExp(ARROW_UP_KEYCODE + "|" + ARROW_DOWN_KEYCODE + "|" + ESCAPE_KEYCODE);
  var Event = {
    HIDE: "hide" + EVENT_KEY,
    HIDDEN: "hidden" + EVENT_KEY,
    SHOW: "show" + EVENT_KEY,
    SHOWN: "shown" + EVENT_KEY,
    CLICK: "click" + EVENT_KEY,
    CLICK_DATA_API: "click" + EVENT_KEY + DATA_API_KEY,
    KEYDOWN_DATA_API: "keydown" + EVENT_KEY + DATA_API_KEY,
    KEYUP_DATA_API: "keyup" + EVENT_KEY + DATA_API_KEY
  };
  var ClassName = {
    DISABLED: 'disabled',
    SHOW: 'show',
    DROPUP: 'dropup',
    DROPRIGHT: 'dropright',
    DROPLEFT: 'dropleft',
    MENURIGHT: 'dropdown-menu-right',
    MENULEFT: 'dropdown-menu-left',
    POSITION_STATIC: 'position-static'
  };
  var Selector = {
    DATA_TOGGLE: '[data-toggle="dropdown"]',
    FORM_CHILD: '.dropdown form',
    MENU: '.dropdown-menu',
    NAVBAR_NAV: '.navbar-nav',
    VISIBLE_ITEMS: '.dropdown-menu .dropdown-item:not(.disabled)'
  };
  var AttachmentMap = {
    TOP: 'top-start',
    TOPEND: 'top-end',
    BOTTOM: 'bottom-start',
    BOTTOMEND: 'bottom-end',
    RIGHT: 'right-start',
    RIGHTEND: 'right-end',
    LEFT: 'left-start',
    LEFTEND: 'left-end'
  };
  var Default = {
    offset: 0,
    flip: true,
    boundary: 'scrollParent'
  };
  var DefaultType = {
    offset: '(number|string|function)',
    flip: 'boolean',
    boundary: '(string|element)'
    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };

  var Dropdown =
  /*#__PURE__*/
  function () {
    function Dropdown(element, config) {
      this._element = element;
      this._popper = null;
      this._config = this._getConfig(config);
      this._menu = this._getMenuElement();
      this._inNavbar = this._detectNavbar();

      this._addEventListeners();
    } // Getters


    var _proto = Dropdown.prototype;

    // Public
    _proto.toggle = function toggle() {
      if (this._element.disabled || $(this._element).hasClass(ClassName.DISABLED)) {
        return;
      }

      var parent = Dropdown._getParentFromElement(this._element);

      var isActive = $(this._menu).hasClass(ClassName.SHOW);

      Dropdown._clearMenus();

      if (isActive) {
        return;
      }

      var relatedTarget = {
        relatedTarget: this._element
      };
      var showEvent = $.Event(Event.SHOW, relatedTarget);
      $(parent).trigger(showEvent);

      if (showEvent.isDefaultPrevented()) {
        return;
      } // Disable totally Popper.js for Dropdown in Navbar


      if (!this._inNavbar) {
        /**
         * Check for Popper dependency
         * Popper - https://popper.js.org
         */
        if (typeof Popper === 'undefined') {
          throw new TypeError('Bootstrap dropdown require Popper.js (https://popper.js.org)');
        }

        var element = this._element; // For dropup with alignment we use the parent as popper container

        if ($(parent).hasClass(ClassName.DROPUP)) {
          if ($(this._menu).hasClass(ClassName.MENULEFT) || $(this._menu).hasClass(ClassName.MENURIGHT)) {
            element = parent;
          }
        } // If boundary is not `scrollParent`, then set position to `static`
        // to allow the menu to "escape" the scroll parent's boundaries
        // https://github.com/twbs/bootstrap/issues/24251


        if (this._config.boundary !== 'scrollParent') {
          $(parent).addClass(ClassName.POSITION_STATIC);
        }

        this._popper = new Popper(element, this._menu, this._getPopperConfig());
      } // If this is a touch-enabled device we add extra
      // empty mouseover listeners to the body's immediate children;
      // only needed because of broken event delegation on iOS
      // https://www.quirksmode.org/blog/archives/2014/02/mouse_event_bub.html


      if ('ontouchstart' in document.documentElement && $(parent).closest(Selector.NAVBAR_NAV).length === 0) {
        $('body').children().on('mouseover', null, $.noop);
      }

      this._element.focus();

      this._element.setAttribute('aria-expanded', true);

      $(this._menu).toggleClass(ClassName.SHOW);
      $(parent).toggleClass(ClassName.SHOW).trigger($.Event(Event.SHOWN, relatedTarget));
    };

    _proto.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);
      $(this._element).off(EVENT_KEY);
      this._element = null;
      this._menu = null;

      if (this._popper !== null) {
        this._popper.destroy();

        this._popper = null;
      }
    };

    _proto.update = function update() {
      this._inNavbar = this._detectNavbar();

      if (this._popper !== null) {
        this._popper.scheduleUpdate();
      }
    }; // Private


    _proto._addEventListeners = function _addEventListeners() {
      var _this = this;

      $(this._element).on(Event.CLICK, function (event) {
        event.preventDefault();
        event.stopPropagation();

        _this.toggle();
      });
    };

    _proto._getConfig = function _getConfig(config) {
      config = _extends({}, this.constructor.Default, $(this._element).data(), config);
      Util.typeCheckConfig(NAME, config, this.constructor.DefaultType);
      return config;
    };

    _proto._getMenuElement = function _getMenuElement() {
      if (!this._menu) {
        var parent = Dropdown._getParentFromElement(this._element);

        this._menu = $(parent).find(Selector.MENU)[0];
      }

      return this._menu;
    };

    _proto._getPlacement = function _getPlacement() {
      var $parentDropdown = $(this._element).parent();
      var placement = AttachmentMap.BOTTOM; // Handle dropup

      if ($parentDropdown.hasClass(ClassName.DROPUP)) {
        placement = AttachmentMap.TOP;

        if ($(this._menu).hasClass(ClassName.MENURIGHT)) {
          placement = AttachmentMap.TOPEND;
        }
      } else if ($parentDropdown.hasClass(ClassName.DROPRIGHT)) {
        placement = AttachmentMap.RIGHT;
      } else if ($parentDropdown.hasClass(ClassName.DROPLEFT)) {
        placement = AttachmentMap.LEFT;
      } else if ($(this._menu).hasClass(ClassName.MENURIGHT)) {
        placement = AttachmentMap.BOTTOMEND;
      }

      return placement;
    };

    _proto._detectNavbar = function _detectNavbar() {
      return $(this._element).closest('.navbar').length > 0;
    };

    _proto._getPopperConfig = function _getPopperConfig() {
      var _this2 = this;

      var offsetConf = {};

      if (typeof this._config.offset === 'function') {
        offsetConf.fn = function (data) {
          data.offsets = _extends({}, data.offsets, _this2._config.offset(data.offsets) || {});
          return data;
        };
      } else {
        offsetConf.offset = this._config.offset;
      }

      var popperConfig = {
        placement: this._getPlacement(),
        modifiers: {
          offset: offsetConf,
          flip: {
            enabled: this._config.flip
          },
          preventOverflow: {
            boundariesElement: this._config.boundary
          }
        }
      };
      return popperConfig;
    }; // Static


    Dropdown._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);

        var _config = typeof config === 'object' ? config : null;

        if (!data) {
          data = new Dropdown(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (typeof data[config] === 'undefined') {
            throw new TypeError("No method named \"" + config + "\"");
          }

          data[config]();
        }
      });
    };

    Dropdown._clearMenus = function _clearMenus(event) {
      if (event && (event.which === RIGHT_MOUSE_BUTTON_WHICH || event.type === 'keyup' && event.which !== TAB_KEYCODE)) {
        return;
      }

      var toggles = $.makeArray($(Selector.DATA_TOGGLE));

      for (var i = 0; i < toggles.length; i++) {
        var parent = Dropdown._getParentFromElement(toggles[i]);

        var context = $(toggles[i]).data(DATA_KEY);
        var relatedTarget = {
          relatedTarget: toggles[i]
        };

        if (!context) {
          continue;
        }

        var dropdownMenu = context._menu;

        if (!$(parent).hasClass(ClassName.SHOW)) {
          continue;
        }

        if (event && (event.type === 'click' && /input|textarea/i.test(event.target.tagName) || event.type === 'keyup' && event.which === TAB_KEYCODE) && $.contains(parent, event.target)) {
          continue;
        }

        var hideEvent = $.Event(Event.HIDE, relatedTarget);
        $(parent).trigger(hideEvent);

        if (hideEvent.isDefaultPrevented()) {
          continue;
        } // If this is a touch-enabled device we remove the extra
        // empty mouseover listeners we added for iOS support


        if ('ontouchstart' in document.documentElement) {
          $('body').children().off('mouseover', null, $.noop);
        }

        toggles[i].setAttribute('aria-expanded', 'false');
        $(dropdownMenu).removeClass(ClassName.SHOW);
        $(parent).removeClass(ClassName.SHOW).trigger($.Event(Event.HIDDEN, relatedTarget));
      }
    };

    Dropdown._getParentFromElement = function _getParentFromElement(element) {
      var parent;
      var selector = Util.getSelectorFromElement(element);

      if (selector) {
        parent = $(selector)[0];
      }

      return parent || element.parentNode;
    }; // eslint-disable-next-line complexity


    Dropdown._dataApiKeydownHandler = function _dataApiKeydownHandler(event) {
      // If not input/textarea:
      //  - And not a key in REGEXP_KEYDOWN => not a dropdown command
      // If input/textarea:
      //  - If space key => not a dropdown command
      //  - If key is other than escape
      //    - If key is not up or down => not a dropdown command
      //    - If trigger inside the menu => not a dropdown command
      if (/input|textarea/i.test(event.target.tagName) ? event.which === SPACE_KEYCODE || event.which !== ESCAPE_KEYCODE && (event.which !== ARROW_DOWN_KEYCODE && event.which !== ARROW_UP_KEYCODE || $(event.target).closest(Selector.MENU).length) : !REGEXP_KEYDOWN.test(event.which)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (this.disabled || $(this).hasClass(ClassName.DISABLED)) {
        return;
      }

      var parent = Dropdown._getParentFromElement(this);

      var isActive = $(parent).hasClass(ClassName.SHOW);

      if (!isActive && (event.which !== ESCAPE_KEYCODE || event.which !== SPACE_KEYCODE) || isActive && (event.which === ESCAPE_KEYCODE || event.which === SPACE_KEYCODE)) {
        if (event.which === ESCAPE_KEYCODE) {
          var toggle = $(parent).find(Selector.DATA_TOGGLE)[0];
          $(toggle).trigger('focus');
        }

        $(this).trigger('click');
        return;
      }

      var items = $(parent).find(Selector.VISIBLE_ITEMS).get();

      if (items.length === 0) {
        return;
      }

      var index = items.indexOf(event.target);

      if (event.which === ARROW_UP_KEYCODE && index > 0) {
        // Up
        index--;
      }

      if (event.which === ARROW_DOWN_KEYCODE && index < items.length - 1) {
        // Down
        index++;
      }

      if (index < 0) {
        index = 0;
      }

      items[index].focus();
    };

    _createClass(Dropdown, null, [{
      key: "VERSION",
      get: function get() {
        return VERSION;
      }
    }, {
      key: "Default",
      get: function get() {
        return Default;
      }
    }, {
      key: "DefaultType",
      get: function get() {
        return DefaultType;
      }
    }]);

    return Dropdown;
  }();
  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */


  $(document).on(Event.KEYDOWN_DATA_API, Selector.DATA_TOGGLE, Dropdown._dataApiKeydownHandler).on(Event.KEYDOWN_DATA_API, Selector.MENU, Dropdown._dataApiKeydownHandler).on(Event.CLICK_DATA_API + " " + Event.KEYUP_DATA_API, Dropdown._clearMenus).on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE, function (event) {
    event.preventDefault();
    event.stopPropagation();

    Dropdown._jQueryInterface.call($(this), 'toggle');
  }).on(Event.CLICK_DATA_API, Selector.FORM_CHILD, function (e) {
    e.stopPropagation();
  });
  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Dropdown._jQueryInterface;
  $.fn[NAME].Constructor = Dropdown;

  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Dropdown._jQueryInterface;
  };

  return Dropdown;
}($, Popper);
//# sourceMappingURL=dropdown.js.map
;function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0): scrollspy.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */
var ScrollSpy = function ($) {
  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */
  var NAME = 'scrollspy';
  var VERSION = '4.0.0';
  var DATA_KEY = 'bs.scrollspy';
  var EVENT_KEY = "." + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var Default = {
    offset: 10,
    method: 'auto',
    target: ''
  };
  var DefaultType = {
    offset: 'number',
    method: 'string',
    target: '(string|element)'
  };
  var Event = {
    ACTIVATE: "activate" + EVENT_KEY,
    SCROLL: "scroll" + EVENT_KEY,
    LOAD_DATA_API: "load" + EVENT_KEY + DATA_API_KEY
  };
  var ClassName = {
    DROPDOWN_ITEM: 'dropdown-item',
    DROPDOWN_MENU: 'dropdown-menu',
    ACTIVE: 'active'
  };
  var Selector = {
    DATA_SPY: '[data-spy="scroll"]',
    ACTIVE: '.active',
    NAV_LIST_GROUP: '.nav, .list-group',
    NAV_LINKS: '.nav-link',
    NAV_ITEMS: '.nav-item',
    LIST_ITEMS: '.list-group-item',
    DROPDOWN: '.dropdown',
    DROPDOWN_ITEMS: '.dropdown-item',
    DROPDOWN_TOGGLE: '.dropdown-toggle'
  };
  var OffsetMethod = {
    OFFSET: 'offset',
    POSITION: 'position'
    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };

  var ScrollSpy =
  /*#__PURE__*/
  function () {
    function ScrollSpy(element, config) {
      var _this = this;

      this._element = element;
      this._scrollElement = element.tagName === 'BODY' ? window : element;
      this._config = this._getConfig(config);
      this._selector = this._config.target + " " + Selector.NAV_LINKS + "," + (this._config.target + " " + Selector.LIST_ITEMS + ",") + (this._config.target + " " + Selector.DROPDOWN_ITEMS);
      this._offsets = [];
      this._targets = [];
      this._activeTarget = null;
      this._scrollHeight = 0;
      $(this._scrollElement).on(Event.SCROLL, function (event) {
        return _this._process(event);
      });
      this.refresh();

      this._process();
    } // Getters


    var _proto = ScrollSpy.prototype;

    // Public
    _proto.refresh = function refresh() {
      var _this2 = this;

      var autoMethod = this._scrollElement === this._scrollElement.window ? OffsetMethod.OFFSET : OffsetMethod.POSITION;
      var offsetMethod = this._config.method === 'auto' ? autoMethod : this._config.method;
      var offsetBase = offsetMethod === OffsetMethod.POSITION ? this._getScrollTop() : 0;
      this._offsets = [];
      this._targets = [];
      this._scrollHeight = this._getScrollHeight();
      var targets = $.makeArray($(this._selector));
      targets.map(function (element) {
        var target;
        var targetSelector = Util.getSelectorFromElement(element);

        if (targetSelector) {
          target = $(targetSelector)[0];
        }

        if (target) {
          var targetBCR = target.getBoundingClientRect();

          if (targetBCR.width || targetBCR.height) {
            // TODO (fat): remove sketch reliance on jQuery position/offset
            return [$(target)[offsetMethod]().top + offsetBase, targetSelector];
          }
        }

        return null;
      }).filter(function (item) {
        return item;
      }).sort(function (a, b) {
        return a[0] - b[0];
      }).forEach(function (item) {
        _this2._offsets.push(item[0]);

        _this2._targets.push(item[1]);
      });
    };

    _proto.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);
      $(this._scrollElement).off(EVENT_KEY);
      this._element = null;
      this._scrollElement = null;
      this._config = null;
      this._selector = null;
      this._offsets = null;
      this._targets = null;
      this._activeTarget = null;
      this._scrollHeight = null;
    }; // Private


    _proto._getConfig = function _getConfig(config) {
      config = _extends({}, Default, config);

      if (typeof config.target !== 'string') {
        var id = $(config.target).attr('id');

        if (!id) {
          id = Util.getUID(NAME);
          $(config.target).attr('id', id);
        }

        config.target = "#" + id;
      }

      Util.typeCheckConfig(NAME, config, DefaultType);
      return config;
    };

    _proto._getScrollTop = function _getScrollTop() {
      return this._scrollElement === window ? this._scrollElement.pageYOffset : this._scrollElement.scrollTop;
    };

    _proto._getScrollHeight = function _getScrollHeight() {
      return this._scrollElement.scrollHeight || Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    };

    _proto._getOffsetHeight = function _getOffsetHeight() {
      return this._scrollElement === window ? window.innerHeight : this._scrollElement.getBoundingClientRect().height;
    };

    _proto._process = function _process() {
      var scrollTop = this._getScrollTop() + this._config.offset;

      var scrollHeight = this._getScrollHeight();

      var maxScroll = this._config.offset + scrollHeight - this._getOffsetHeight();

      if (this._scrollHeight !== scrollHeight) {
        this.refresh();
      }

      if (scrollTop >= maxScroll) {
        var target = this._targets[this._targets.length - 1];

        if (this._activeTarget !== target) {
          this._activate(target);
        }

        return;
      }

      if (this._activeTarget && scrollTop < this._offsets[0] && this._offsets[0] > 0) {
        this._activeTarget = null;

        this._clear();

        return;
      }

      for (var i = this._offsets.length; i--;) {
        var isActiveTarget = this._activeTarget !== this._targets[i] && scrollTop >= this._offsets[i] && (typeof this._offsets[i + 1] === 'undefined' || scrollTop < this._offsets[i + 1]);

        if (isActiveTarget) {
          this._activate(this._targets[i]);
        }
      }
    };

    _proto._activate = function _activate(target) {
      this._activeTarget = target;

      this._clear();

      var queries = this._selector.split(','); // eslint-disable-next-line arrow-body-style


      queries = queries.map(function (selector) {
        return selector + "[data-target=\"" + target + "\"]," + (selector + "[href=\"" + target + "\"]");
      });
      var $link = $(queries.join(','));

      if ($link.hasClass(ClassName.DROPDOWN_ITEM)) {
        $link.closest(Selector.DROPDOWN).find(Selector.DROPDOWN_TOGGLE).addClass(ClassName.ACTIVE);
        $link.addClass(ClassName.ACTIVE);
      } else {
        // Set triggered link as active
        $link.addClass(ClassName.ACTIVE); // Set triggered links parents as active
        // With both <ul> and <nav> markup a parent is the previous sibling of any nav ancestor

        $link.parents(Selector.NAV_LIST_GROUP).prev(Selector.NAV_LINKS + ", " + Selector.LIST_ITEMS).addClass(ClassName.ACTIVE); // Handle special case when .nav-link is inside .nav-item

        $link.parents(Selector.NAV_LIST_GROUP).prev(Selector.NAV_ITEMS).children(Selector.NAV_LINKS).addClass(ClassName.ACTIVE);
      }

      $(this._scrollElement).trigger(Event.ACTIVATE, {
        relatedTarget: target
      });
    };

    _proto._clear = function _clear() {
      $(this._selector).filter(Selector.ACTIVE).removeClass(ClassName.ACTIVE);
    }; // Static


    ScrollSpy._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var data = $(this).data(DATA_KEY);

        var _config = typeof config === 'object' && config;

        if (!data) {
          data = new ScrollSpy(this, _config);
          $(this).data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (typeof data[config] === 'undefined') {
            throw new TypeError("No method named \"" + config + "\"");
          }

          data[config]();
        }
      });
    };

    _createClass(ScrollSpy, null, [{
      key: "VERSION",
      get: function get() {
        return VERSION;
      }
    }, {
      key: "Default",
      get: function get() {
        return Default;
      }
    }]);

    return ScrollSpy;
  }();
  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */


  $(window).on(Event.LOAD_DATA_API, function () {
    var scrollSpys = $.makeArray($(Selector.DATA_SPY));

    for (var i = scrollSpys.length; i--;) {
      var $spy = $(scrollSpys[i]);

      ScrollSpy._jQueryInterface.call($spy, $spy.data());
    }
  });
  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = ScrollSpy._jQueryInterface;
  $.fn[NAME].Constructor = ScrollSpy;

  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return ScrollSpy._jQueryInterface;
  };

  return ScrollSpy;
}($);
//# sourceMappingURL=scrollspy.js.map
;function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0): tab.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */
var Tab = function ($) {
  /**
   * ------------------------------------------------------------------------
   * Constants
   * ------------------------------------------------------------------------
   */
  var NAME = 'tab';
  var VERSION = '4.0.0';
  var DATA_KEY = 'bs.tab';
  var EVENT_KEY = "." + DATA_KEY;
  var DATA_API_KEY = '.data-api';
  var JQUERY_NO_CONFLICT = $.fn[NAME];
  var TRANSITION_DURATION = 150;
  var Event = {
    HIDE: "hide" + EVENT_KEY,
    HIDDEN: "hidden" + EVENT_KEY,
    SHOW: "show" + EVENT_KEY,
    SHOWN: "shown" + EVENT_KEY,
    CLICK_DATA_API: "click" + EVENT_KEY + DATA_API_KEY
  };
  var ClassName = {
    DROPDOWN_MENU: 'dropdown-menu',
    ACTIVE: 'active',
    DISABLED: 'disabled',
    FADE: 'fade',
    SHOW: 'show'
  };
  var Selector = {
    DROPDOWN: '.dropdown',
    NAV_LIST_GROUP: '.nav, .list-group',
    ACTIVE: '.active',
    ACTIVE_UL: '> li > .active',
    DATA_TOGGLE: '[data-toggle="tab"], [data-toggle="pill"], [data-toggle="list"]',
    DROPDOWN_TOGGLE: '.dropdown-toggle',
    DROPDOWN_ACTIVE_CHILD: '> .dropdown-menu .active'
    /**
     * ------------------------------------------------------------------------
     * Class Definition
     * ------------------------------------------------------------------------
     */

  };

  var Tab =
  /*#__PURE__*/
  function () {
    function Tab(element) {
      this._element = element;
    } // Getters


    var _proto = Tab.prototype;

    // Public
    _proto.show = function show() {
      var _this = this;

      if (this._element.parentNode && this._element.parentNode.nodeType === Node.ELEMENT_NODE && $(this._element).hasClass(ClassName.ACTIVE) || $(this._element).hasClass(ClassName.DISABLED)) {
        return;
      }

      var target;
      var previous;
      var listElement = $(this._element).closest(Selector.NAV_LIST_GROUP)[0];
      var selector = Util.getSelectorFromElement(this._element);

      if (listElement) {
        var itemSelector = listElement.nodeName === 'UL' ? Selector.ACTIVE_UL : Selector.ACTIVE;
        previous = $.makeArray($(listElement).find(itemSelector));
        previous = previous[previous.length - 1];
      }

      var hideEvent = $.Event(Event.HIDE, {
        relatedTarget: this._element
      });
      var showEvent = $.Event(Event.SHOW, {
        relatedTarget: previous
      });

      if (previous) {
        $(previous).trigger(hideEvent);
      }

      $(this._element).trigger(showEvent);

      if (showEvent.isDefaultPrevented() || hideEvent.isDefaultPrevented()) {
        return;
      }

      if (selector) {
        target = $(selector)[0];
      }

      this._activate(this._element, listElement);

      var complete = function complete() {
        var hiddenEvent = $.Event(Event.HIDDEN, {
          relatedTarget: _this._element
        });
        var shownEvent = $.Event(Event.SHOWN, {
          relatedTarget: previous
        });
        $(previous).trigger(hiddenEvent);
        $(_this._element).trigger(shownEvent);
      };

      if (target) {
        this._activate(target, target.parentNode, complete);
      } else {
        complete();
      }
    };

    _proto.dispose = function dispose() {
      $.removeData(this._element, DATA_KEY);
      this._element = null;
    }; // Private


    _proto._activate = function _activate(element, container, callback) {
      var _this2 = this;

      var activeElements;

      if (container.nodeName === 'UL') {
        activeElements = $(container).find(Selector.ACTIVE_UL);
      } else {
        activeElements = $(container).children(Selector.ACTIVE);
      }

      var active = activeElements[0];
      var isTransitioning = callback && Util.supportsTransitionEnd() && active && $(active).hasClass(ClassName.FADE);

      var complete = function complete() {
        return _this2._transitionComplete(element, active, callback);
      };

      if (active && isTransitioning) {
        $(active).one(Util.TRANSITION_END, complete).emulateTransitionEnd(TRANSITION_DURATION);
      } else {
        complete();
      }
    };

    _proto._transitionComplete = function _transitionComplete(element, active, callback) {
      if (active) {
        $(active).removeClass(ClassName.SHOW + " " + ClassName.ACTIVE);
        var dropdownChild = $(active.parentNode).find(Selector.DROPDOWN_ACTIVE_CHILD)[0];

        if (dropdownChild) {
          $(dropdownChild).removeClass(ClassName.ACTIVE);
        }

        if (active.getAttribute('role') === 'tab') {
          active.setAttribute('aria-selected', false);
        }
      }

      $(element).addClass(ClassName.ACTIVE);

      if (element.getAttribute('role') === 'tab') {
        element.setAttribute('aria-selected', true);
      }

      Util.reflow(element);
      $(element).addClass(ClassName.SHOW);

      if (element.parentNode && $(element.parentNode).hasClass(ClassName.DROPDOWN_MENU)) {
        var dropdownElement = $(element).closest(Selector.DROPDOWN)[0];

        if (dropdownElement) {
          $(dropdownElement).find(Selector.DROPDOWN_TOGGLE).addClass(ClassName.ACTIVE);
        }

        element.setAttribute('aria-expanded', true);
      }

      if (callback) {
        callback();
      }
    }; // Static


    Tab._jQueryInterface = function _jQueryInterface(config) {
      return this.each(function () {
        var $this = $(this);
        var data = $this.data(DATA_KEY);

        if (!data) {
          data = new Tab(this);
          $this.data(DATA_KEY, data);
        }

        if (typeof config === 'string') {
          if (typeof data[config] === 'undefined') {
            throw new TypeError("No method named \"" + config + "\"");
          }

          data[config]();
        }
      });
    };

    _createClass(Tab, null, [{
      key: "VERSION",
      get: function get() {
        return VERSION;
      }
    }]);

    return Tab;
  }();
  /**
   * ------------------------------------------------------------------------
   * Data Api implementation
   * ------------------------------------------------------------------------
   */


  $(document).on(Event.CLICK_DATA_API, Selector.DATA_TOGGLE, function (event) {
    event.preventDefault();

    Tab._jQueryInterface.call($(this), 'show');
  });
  /**
   * ------------------------------------------------------------------------
   * jQuery
   * ------------------------------------------------------------------------
   */

  $.fn[NAME] = Tab._jQueryInterface;
  $.fn[NAME].Constructor = Tab;

  $.fn[NAME].noConflict = function () {
    $.fn[NAME] = JQUERY_NO_CONFLICT;
    return Tab._jQueryInterface;
  };

  return Tab;
}($);
//# sourceMappingURL=tab.js.map
;/**
 * --------------------------------------------------------------------------
 * Bootstrap (v4.0.0): util.js
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * --------------------------------------------------------------------------
 */
var Util = function ($) {
  /**
   * ------------------------------------------------------------------------
   * Private TransitionEnd Helpers
   * ------------------------------------------------------------------------
   */
  var transition = false;
  var MAX_UID = 1000000; // Shoutout AngusCroll (https://goo.gl/pxwQGp)

  function toType(obj) {
    return {}.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
  }

  function getSpecialTransitionEndEvent() {
    return {
      bindType: transition.end,
      delegateType: transition.end,
      handle: function handle(event) {
        if ($(event.target).is(this)) {
          return event.handleObj.handler.apply(this, arguments); // eslint-disable-line prefer-rest-params
        }

        return undefined; // eslint-disable-line no-undefined
      }
    };
  }

  function transitionEndTest() {
    if (typeof window !== 'undefined' && window.QUnit) {
      return false;
    }

    return {
      end: 'transitionend'
    };
  }

  function transitionEndEmulator(duration) {
    var _this = this;

    var called = false;
    $(this).one(Util.TRANSITION_END, function () {
      called = true;
    });
    setTimeout(function () {
      if (!called) {
        Util.triggerTransitionEnd(_this);
      }
    }, duration);
    return this;
  }

  function setTransitionEndSupport() {
    transition = transitionEndTest();
    $.fn.emulateTransitionEnd = transitionEndEmulator;

    if (Util.supportsTransitionEnd()) {
      $.event.special[Util.TRANSITION_END] = getSpecialTransitionEndEvent();
    }
  }

  function escapeId(selector) {
    // We escape IDs in case of special selectors (selector = '#myId:something')
    // $.escapeSelector does not exist in jQuery < 3
    selector = typeof $.escapeSelector === 'function' ? $.escapeSelector(selector).substr(1) : selector.replace(/(:|\.|\[|\]|,|=|@)/g, '\\$1');
    return selector;
  }
  /**
   * --------------------------------------------------------------------------
   * Public Util Api
   * --------------------------------------------------------------------------
   */


  var Util = {
    TRANSITION_END: 'bsTransitionEnd',
    getUID: function getUID(prefix) {
      do {
        // eslint-disable-next-line no-bitwise
        prefix += ~~(Math.random() * MAX_UID); // "~~" acts like a faster Math.floor() here
      } while (document.getElementById(prefix));

      return prefix;
    },
    getSelectorFromElement: function getSelectorFromElement(element) {
      var selector = element.getAttribute('data-target');

      if (!selector || selector === '#') {
        selector = element.getAttribute('href') || '';
      } // If it's an ID


      if (selector.charAt(0) === '#') {
        selector = escapeId(selector);
      }

      try {
        var $selector = $(document).find(selector);
        return $selector.length > 0 ? selector : null;
      } catch (err) {
        return null;
      }
    },
    reflow: function reflow(element) {
      return element.offsetHeight;
    },
    triggerTransitionEnd: function triggerTransitionEnd(element) {
      $(element).trigger(transition.end);
    },
    supportsTransitionEnd: function supportsTransitionEnd() {
      return Boolean(transition);
    },
    isElement: function isElement(obj) {
      return (obj[0] || obj).nodeType;
    },
    typeCheckConfig: function typeCheckConfig(componentName, config, configTypes) {
      for (var property in configTypes) {
        if (Object.prototype.hasOwnProperty.call(configTypes, property)) {
          var expectedTypes = configTypes[property];
          var value = config[property];
          var valueType = value && Util.isElement(value) ? 'element' : toType(value);

          if (!new RegExp(expectedTypes).test(valueType)) {
            throw new Error(componentName.toUpperCase() + ": " + ("Option \"" + property + "\" provided type \"" + valueType + "\" ") + ("but expected type \"" + expectedTypes + "\"."));
          }
        }
      }
    }
  };
  setTransitionEndSupport();
  return Util;
}($);
//# sourceMappingURL=util.js.map
;(function($){

    $(document).ready(function() {

        /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
        /* ~~~~~~~~~~ Plugin Inits ~~~~~~~~~~ */
        /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

            /* ~~~~~~~~~~ Match height ~~~~~~~~~~ */

            $('.match-height').matchHeight({
                byRow: true,
                property: 'min-height',
                target: null,
                remove: false
            });


            /* ~~~~~~~~~~ Mobile navigation ~~~~~~~~~~ */

            $('.main-header').addClass('mmenu-fixed');

            if($('#wpadminbar').length) {
                $('#wpadminbar').addClass('mmenu-fixed');
            }

            var $menu = $("#mobile-navigation").mmenu({
                "extensions": [
                    "pagedim-black",
                    "theme-dark"
                ],
                "slidingSubmenus": false,
                "offCanvas": {
                    "position": "right"
                },
                "navbars": [
                    {
                        "position": "top"
                    }
                ]
            }, {
                classNames: {
                    fixedElements: {
                        fixed: "mmenu-fixed",
                        elemInsertSelector: '.main-content'
                    }
                }
            });

            var $icon = $("#mmenu-triger");
            var API = $menu.data( "mmenu" );

            $icon.on( "click", function() {
                if($icon.hasClass('is-active')) {
                    API.close();
                } else {
                    API.open();
                }
            });

            API.bind( "opened", function() {
               setTimeout(function() {
                  $icon.addClass( "is-active" );
               }, 10);
            });
            API.bind( "closed", function() {
               setTimeout(function() {
                  $icon.removeClass( "is-active" );
               }, 10);
            });


            /* ~~~~~~~~~~ Lazy Loading ~~~~~~~~~~ */

            $('.lazy').Lazy({
                effect: 'fadeIn'
            });


            /* ~~~~~~~~~~ Fancybox Init ~~~~~~~~~~ */

            $(".content a[href*='.jpg'], .content a[href*='.jpeg'], .content a[href*='.png']").fancybox();

            $('[data-fancybox]').fancybox({
                youtube : {
                    autoplay : 1
                }
            });


        /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
        /* ~~~~~~~~~~ Functions ~~~~~~~~~~ */
        /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

            /* ~~~~~~~~~~ Modal fix ~~~~~~~~~~ */

            $('.modal').appendTo($('body'));


            /* ~~~~~~~~~~ Set animation scroll when URL is with #anchor and make smooth scroll ~~~~~~~~~~ */

            $(function(){
                if ( window.location.hash ) scroll(0,0);
                setTimeout( function() { scroll(0,0); }, 1);

                var headerHeight = $('.main-header').height();

                if($('#wpadminbar').length) {
                    headerHeight += $('#wpadminbar').height();
                }

                $('a[href*="#"]:not(.mm-next)').on('click', function(e) {
                    e.preventDefault();

                    $('html, body').animate({
                        scrollTop: ($($(this).attr('href')).offset().top - headerHeight) + 'px'
                    }, 1000, 'swing');
                });

                if(window.location.hash) {
                    $('html, body').animate({
                        scrollTop: ($(window.location.hash).offset().top - headerHeight) + 'px'
                    }, 1000, 'swing');
                }
            });


            /* ~~~~~~~~~~ Return to top button ~~~~~~~~~~ */

            $(window).scroll(function() {
                if ($(this).scrollTop() >= 100) {
                    $('.return-to-top').addClass('return-to-top--visible');
                } else {
                    $('.return-to-top').removeClass('return-to-top--visible');
                }
            });

            $('#return-to-top').click(function() {
                $('body,html').animate({
                    scrollTop : 0
                }, 1000, 'swing');
            });


            /* ~~~~~~~~~~ First content element fix ~~~~~~~~~~ */

            $('.content').prepend('<span class="first-element-fix"></span>');
            $('blockquote').prepend('<span class="first-element-fix"></span>');
            $('.panel').prepend('<span class="first-element-fix"></span>');


            /* ~~~~~~~~~~ Mobile navigation ~~~~~~~~~~ */

            $('#mobile-navigation .navigation li a').addClass('mm-fullsubopen');


            /* ~~~~~~~~~~ Make dropdowns visible on hover ~~~~~~~~~~ */

            $('ul.navbar-nav li.dropdown').hover(function() {
                $(this).find('.dropdown-menu').stop(true, true).delay(50).fadeIn();
            }, function() {
                $(this).find('.dropdown-menu').stop(true, true).delay(50).fadeOut();
            });


            /* ~~~~~~~~~~ Delete empty <p> elements ~~~~~~~~~~~ */

            $('p').each(function() {
                var $this = $(this);
                if($this.html().replace(/\s|&nbsp;/g, '').length === 0)
                    $this.remove();
            });


            /* ~~~~~~~~~~ Change navigation after scroll ~~~~~~~~~~ */

            $(window).scroll(function() {
                if ($(this).scrollTop() >= 100) {
                    $('.main-header').addClass('main-header--scrolled');
                } else {
                    $('.main-header').removeClass('main-header--scrolled');
                }
            });


            /* ~~~~~~~~~~ Replace all SVG images with inline SVG ~~~~~~~~~~ */

            jQuery('img.svg').each(function(){
                var $img = jQuery(this);
                var imgID = $img.attr('id');
                var imgClass = $img.attr('class');
                var imgURL = $img.attr('src');

                jQuery.get(imgURL, function(data) {
                    var $svg = jQuery(data).find('svg');

                    if(typeof imgID !== 'undefined') {
                        $svg = $svg.attr('id', imgID);
                    }

                    if(typeof imgClass !== 'undefined') {
                        $svg = $svg.attr('class', imgClass+' replaced-svg');
                    }

                    $svg = $svg.removeAttr('xmlns:a');
                    $img.replaceWith($svg);
                }, 'xml');
            });


            /* ~~~~~~~~~~ Play Iframe Video ~~~~~~~~~~ */

            $('.video__play-button').click(function(){
                $(this).parent().addClass('no-after');
                $(this).parent().html('<iframe src="'+$(this).data('vimeo-src')+'?portrait=0&title=0&badge=0&byline=0&autoplay=1" width="100%" height="100%" frameborder="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe>');
            });

    });


    $(window).bind('load resize orientationChange', function () {

        /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
        /* ~~~~~~~~~~ Functions ~~~~~~~~~~ */
        /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

            /* ~~~~~~~~~~ AOS Refresh ~~~~~~~~~~ */

            // AOS.refresh();


            /* ~~~~~~~~~~ Bootstrap modal margin top if WP admin exist ~~~~~~~~~~ */

            if($('#wpadminbar').length) {
                $('.modal').on('shown.bs.modal', function (e) {
                    var WPAdminBarHeight = $('#wpadminbar').height();
                    $('.modal').css("margin-top", (WPAdminBarHeight + 30));
                });
            }


            /* ~~~~~~~~~~ Sticky Footer ~~~~~~~~~~ */

            if(!$('.homepage-template').length) {
                $(function(){
                    var $footer = $('.footer-wrapper');

                    var pos = $footer.position(),
                        height = ($(window).outerHeight() - pos.top) - ($footer.outerHeight() + 2);

                    if (height > 0) {
                        $footer.css('margin-top', height);
                    }
                });
            }
    });


    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~ Resuable functions ~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

        /* ~~~~~~~~~~ Check if current devices is mobile ~~~~~~~~~~ */

        function isMobile() {
            try{ document.createEvent("TouchEvent"); return true; }
            catch(e){ return false; }
        }

})(jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LmpzIiwianF1ZXJ5LmZhbmN5Ym94LmpzIiwianF1ZXJ5LmxhenkuanMiLCJqcXVlcnkuZWFzaW5nLmNvbXBhdGliaWxpdHkuanMiLCJqcXVlcnkuZWFzaW5nLmpzIiwianF1ZXJ5Lm1tZW51LmFsbC5taW4uanMiLCJqcXVlcnkubW1lbnUuZml4ZWRlbGVtZW50cy5taW4uanMiLCJqcXVlcnkubWF0Y2hIZWlnaHQuanMiLCJ3ZWJmb250bG9hZGVyLmpzIiwiY29sbGFwc2UuanMiLCJkcm9wZG93bi5qcyIsInNjcm9sbHNweS5qcyIsInRhYi5qcyIsInV0aWwuanMiLCJjdXN0b20uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Q0E3NEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0NDcmlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Q0NsaEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Q0N2MkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0NDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0NDNU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0NDeEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0NDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtDQ3BZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Q0NqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0NDdFhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtDQ3RkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0NDNVRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Q0MxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Q0MxSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6InNjcmlwdHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiohXG4gKiBAZmlsZU92ZXJ2aWV3IEtpY2thc3MgbGlicmFyeSB0byBjcmVhdGUgYW5kIHBsYWNlIHBvcHBlcnMgbmVhciB0aGVpciByZWZlcmVuY2UgZWxlbWVudHMuXG4gKiBAdmVyc2lvbiAxLjEuN1xuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxNiBGZWRlcmljbyBaaXZvbG8gYW5kIGNvbnRyaWJ1dG9yc1xuICpcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcbiAqXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpbiBhbGxcbiAqIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKlxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRVxuICogU09GVFdBUkUuXG4gKi9cbihmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG5cdHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShyZXF1aXJlKCdwb3BwZXIuanMnKSkgOlxuXHR0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoWydwb3BwZXIuanMnXSwgZmFjdG9yeSkgOlxuXHQoZ2xvYmFsLlRvb2x0aXAgPSBmYWN0b3J5KGdsb2JhbC5Qb3BwZXIpKTtcbn0odGhpcywgKGZ1bmN0aW9uIChQb3BwZXIpIHsgJ3VzZSBzdHJpY3QnO1xuXG5Qb3BwZXIgPSBQb3BwZXIgJiYgJ2RlZmF1bHQnIGluIFBvcHBlciA/IFBvcHBlclsnZGVmYXVsdCddIDogUG9wcGVyO1xuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBnaXZlbiB2YXJpYWJsZSBpcyBhIGZ1bmN0aW9uXG4gKiBAbWV0aG9kXG4gKiBAbWVtYmVyb2YgUG9wcGVyLlV0aWxzXG4gKiBAYXJndW1lbnQge0FueX0gZnVuY3Rpb25Ub0NoZWNrIC0gdmFyaWFibGUgdG8gY2hlY2tcbiAqIEByZXR1cm5zIHtCb29sZWFufSBhbnN3ZXIgdG86IGlzIGEgZnVuY3Rpb24/XG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oZnVuY3Rpb25Ub0NoZWNrKSB7XG4gIHZhciBnZXRUeXBlID0ge307XG4gIHJldHVybiBmdW5jdGlvblRvQ2hlY2sgJiYgZ2V0VHlwZS50b1N0cmluZy5jYWxsKGZ1bmN0aW9uVG9DaGVjaykgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbnZhciBjbGFzc0NhbGxDaGVjayA9IGZ1bmN0aW9uIChpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHtcbiAgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpO1xuICB9XG59O1xuXG52YXIgY3JlYXRlQ2xhc3MgPSBmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07XG4gICAgICBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7XG4gICAgICBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7XG4gICAgICBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG4gICAgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTtcbiAgICBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTtcbiAgICByZXR1cm4gQ29uc3RydWN0b3I7XG4gIH07XG59KCk7XG5cblxuXG5cblxuXG5cbnZhciBfZXh0ZW5kcyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCkge1xuICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwga2V5KSkge1xuICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0YXJnZXQ7XG59O1xuXG52YXIgREVGQVVMVF9PUFRJT05TID0ge1xuICBjb250YWluZXI6IGZhbHNlLFxuICBkZWxheTogMCxcbiAgaHRtbDogZmFsc2UsXG4gIHBsYWNlbWVudDogJ3RvcCcsXG4gIHRpdGxlOiAnJyxcbiAgdGVtcGxhdGU6ICc8ZGl2IGNsYXNzPVwidG9vbHRpcFwiIHJvbGU9XCJ0b29sdGlwXCI+PGRpdiBjbGFzcz1cInRvb2x0aXAtYXJyb3dcIj48L2Rpdj48ZGl2IGNsYXNzPVwidG9vbHRpcC1pbm5lclwiPjwvZGl2PjwvZGl2PicsXG4gIHRyaWdnZXI6ICdob3ZlciBmb2N1cycsXG4gIG9mZnNldDogMFxufTtcblxudmFyIFRvb2x0aXAgPSBmdW5jdGlvbiAoKSB7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVG9vbHRpcC5qcyBpbnN0YW5jZVxuICAgKiBAY2xhc3MgVG9vbHRpcFxuICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByZWZlcmVuY2UgLSBUaGUgRE9NIG5vZGUgdXNlZCBhcyByZWZlcmVuY2Ugb2YgdGhlIHRvb2x0aXAgKGl0IGNhbiBiZSBhIGpRdWVyeSBlbGVtZW50KS5cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMucGxhY2VtZW50PWJvdHRvbVxuICAgKiAgICAgIFBsYWNlbWVudCBvZiB0aGUgcG9wcGVyIGFjY2VwdGVkIHZhbHVlczogYHRvcCgtc3RhcnQsIC1lbmQpLCByaWdodCgtc3RhcnQsIC1lbmQpLCBib3R0b20oLXN0YXJ0LCAtZW5kKSxcbiAgICogICAgICBsZWZ0KC1zdGFydCwgLWVuZClgXG4gICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8U3RyaW5nfGZhbHNlfSBvcHRpb25zLmNvbnRhaW5lcj1mYWxzZSAtIEFwcGVuZCB0aGUgdG9vbHRpcCB0byBhIHNwZWNpZmljIGVsZW1lbnQuXG4gICAqIEBwYXJhbSB7TnVtYmVyfE9iamVjdH0gb3B0aW9ucy5kZWxheT0wXG4gICAqICAgICAgRGVsYXkgc2hvd2luZyBhbmQgaGlkaW5nIHRoZSB0b29sdGlwIChtcykgLSBkb2VzIG5vdCBhcHBseSB0byBtYW51YWwgdHJpZ2dlciB0eXBlLlxuICAgKiAgICAgIElmIGEgbnVtYmVyIGlzIHN1cHBsaWVkLCBkZWxheSBpcyBhcHBsaWVkIHRvIGJvdGggaGlkZS9zaG93LlxuICAgKiAgICAgIE9iamVjdCBzdHJ1Y3R1cmUgaXM6IGB7IHNob3c6IDUwMCwgaGlkZTogMTAwIH1gXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5odG1sPWZhbHNlIC0gSW5zZXJ0IEhUTUwgaW50byB0aGUgdG9vbHRpcC4gSWYgZmFsc2UsIHRoZSBjb250ZW50IHdpbGwgaW5zZXJ0ZWQgd2l0aCBgaW5uZXJUZXh0YC5cbiAgICogQHBhcmFtIHtTdHJpbmd8UGxhY2VtZW50RnVuY3Rpb259IG9wdGlvbnMucGxhY2VtZW50PSd0b3AnIC0gT25lIG9mIHRoZSBhbGxvd2VkIHBsYWNlbWVudHMsIG9yIGEgZnVuY3Rpb24gcmV0dXJuaW5nIG9uZSBvZiB0aGVtLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMudGVtcGxhdGU9JzxkaXYgY2xhc3M9XCJ0b29sdGlwXCIgcm9sZT1cInRvb2x0aXBcIj48ZGl2IGNsYXNzPVwidG9vbHRpcC1hcnJvd1wiPjwvZGl2PjxkaXYgY2xhc3M9XCJ0b29sdGlwLWlubmVyXCI+PC9kaXY+PC9kaXY+J11cbiAgICogICAgICBCYXNlIEhUTUwgdG8gdXNlZCB3aGVuIGNyZWF0aW5nIHRoZSB0b29sdGlwLlxuICAgKiAgICAgIFRoZSB0b29sdGlwJ3MgYHRpdGxlYCB3aWxsIGJlIGluamVjdGVkIGludG8gdGhlIGAudG9vbHRpcC1pbm5lcmAgb3IgYC50b29sdGlwX19pbm5lcmAuXG4gICAqICAgICAgYC50b29sdGlwLWFycm93YCBvciBgLnRvb2x0aXBfX2Fycm93YCB3aWxsIGJlY29tZSB0aGUgdG9vbHRpcCdzIGFycm93LlxuICAgKiAgICAgIFRoZSBvdXRlcm1vc3Qgd3JhcHBlciBlbGVtZW50IHNob3VsZCBoYXZlIHRoZSBgLnRvb2x0aXBgIGNsYXNzLlxuICAgKiBAcGFyYW0ge1N0cmluZ3xIVE1MRWxlbWVudHxUaXRsZUZ1bmN0aW9ufSBvcHRpb25zLnRpdGxlPScnIC0gRGVmYXVsdCB0aXRsZSB2YWx1ZSBpZiBgdGl0bGVgIGF0dHJpYnV0ZSBpc24ndCBwcmVzZW50LlxuICAgKiBAcGFyYW0ge1N0cmluZ30gW29wdGlvbnMudHJpZ2dlcj0naG92ZXIgZm9jdXMnXVxuICAgKiAgICAgIEhvdyB0b29sdGlwIGlzIHRyaWdnZXJlZCAtIGNsaWNrLCBob3ZlciwgZm9jdXMsIG1hbnVhbC5cbiAgICogICAgICBZb3UgbWF5IHBhc3MgbXVsdGlwbGUgdHJpZ2dlcnM7IHNlcGFyYXRlIHRoZW0gd2l0aCBhIHNwYWNlLiBgbWFudWFsYCBjYW5ub3QgYmUgY29tYmluZWQgd2l0aCBhbnkgb3RoZXIgdHJpZ2dlci5cbiAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gb3B0aW9ucy5ib3VuZGFyaWVzRWxlbWVudFxuICAgKiAgICAgIFRoZSBlbGVtZW50IHVzZWQgYXMgYm91bmRhcmllcyBmb3IgdGhlIHRvb2x0aXAuIEZvciBtb3JlIGluZm9ybWF0aW9uIHJlZmVyIHRvIFBvcHBlci5qcydcbiAgICogICAgICBbYm91bmRhcmllc0VsZW1lbnQgZG9jc10oaHR0cHM6Ly9wb3BwZXIuanMub3JnL3BvcHBlci1kb2N1bWVudGF0aW9uLmh0bWwpXG4gICAqIEBwYXJhbSB7TnVtYmVyfFN0cmluZ30gb3B0aW9ucy5vZmZzZXQ9MCAtIE9mZnNldCBvZiB0aGUgdG9vbHRpcCByZWxhdGl2ZSB0byBpdHMgcmVmZXJlbmNlLiBGb3IgbW9yZSBpbmZvcm1hdGlvbiByZWZlciB0byBQb3BwZXIuanMnXG4gICAqICAgICAgW29mZnNldCBkb2NzXShodHRwczovL3BvcHBlci5qcy5vcmcvcG9wcGVyLWRvY3VtZW50YXRpb24uaHRtbClcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMucG9wcGVyT3B0aW9ucz17fSAtIFBvcHBlciBvcHRpb25zLCB3aWxsIGJlIHBhc3NlZCBkaXJlY3RseSB0byBwb3BwZXIgaW5zdGFuY2UuIEZvciBtb3JlIGluZm9ybWF0aW9uIHJlZmVyIHRvIFBvcHBlci5qcydcbiAgICogICAgICBbb3B0aW9ucyBkb2NzXShodHRwczovL3BvcHBlci5qcy5vcmcvcG9wcGVyLWRvY3VtZW50YXRpb24uaHRtbClcbiAgICogQHJldHVybiB7T2JqZWN0fSBpbnN0YW5jZSAtIFRoZSBnZW5lcmF0ZWQgdG9vbHRpcCBpbnN0YW5jZVxuICAgKi9cbiAgZnVuY3Rpb24gVG9vbHRpcChyZWZlcmVuY2UsIG9wdGlvbnMpIHtcbiAgICBjbGFzc0NhbGxDaGVjayh0aGlzLCBUb29sdGlwKTtcblxuICAgIF9pbml0aWFsaXNlUHJvcHMuY2FsbCh0aGlzKTtcblxuICAgIC8vIGFwcGx5IHVzZXIgb3B0aW9ucyBvdmVyIGRlZmF1bHQgb25lc1xuICAgIG9wdGlvbnMgPSBfZXh0ZW5kcyh7fSwgREVGQVVMVF9PUFRJT05TLCBvcHRpb25zKTtcblxuICAgIHJlZmVyZW5jZS5qcXVlcnkgJiYgKHJlZmVyZW5jZSA9IHJlZmVyZW5jZVswXSk7XG5cbiAgICAvLyBjYWNoZSByZWZlcmVuY2UgYW5kIG9wdGlvbnNcbiAgICB0aGlzLnJlZmVyZW5jZSA9IHJlZmVyZW5jZTtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXG4gICAgLy8gZ2V0IGV2ZW50cyBsaXN0XG4gICAgdmFyIGV2ZW50cyA9IHR5cGVvZiBvcHRpb25zLnRyaWdnZXIgPT09ICdzdHJpbmcnID8gb3B0aW9ucy50cmlnZ2VyLnNwbGl0KCcgJykuZmlsdGVyKGZ1bmN0aW9uICh0cmlnZ2VyKSB7XG4gICAgICByZXR1cm4gWydjbGljaycsICdob3ZlcicsICdmb2N1cyddLmluZGV4T2YodHJpZ2dlcikgIT09IC0xO1xuICAgIH0pIDogW107XG5cbiAgICAvLyBzZXQgaW5pdGlhbCBzdGF0ZVxuICAgIHRoaXMuX2lzT3BlbiA9IGZhbHNlO1xuICAgIHRoaXMuX3BvcHBlck9wdGlvbnMgPSB7fTtcblxuICAgIC8vIHNldCBldmVudCBsaXN0ZW5lcnNcbiAgICB0aGlzLl9zZXRFdmVudExpc3RlbmVycyhyZWZlcmVuY2UsIGV2ZW50cywgb3B0aW9ucyk7XG4gIH1cblxuICAvL1xuICAvLyBQdWJsaWMgbWV0aG9kc1xuICAvL1xuXG4gIC8qKlxuICAgKiBSZXZlYWxzIGFuIGVsZW1lbnQncyB0b29sdGlwLiBUaGlzIGlzIGNvbnNpZGVyZWQgYSBcIm1hbnVhbFwiIHRyaWdnZXJpbmcgb2YgdGhlIHRvb2x0aXAuXG4gICAqIFRvb2x0aXBzIHdpdGggemVyby1sZW5ndGggdGl0bGVzIGFyZSBuZXZlciBkaXNwbGF5ZWQuXG4gICAqIEBtZXRob2QgVG9vbHRpcCNzaG93XG4gICAqIEBtZW1iZXJvZiBUb29sdGlwXG4gICAqL1xuXG5cbiAgLyoqXG4gICAqIEhpZGVzIGFuIGVsZW1lbnTigJlzIHRvb2x0aXAuIFRoaXMgaXMgY29uc2lkZXJlZCBhIOKAnG1hbnVhbOKAnSB0cmlnZ2VyaW5nIG9mIHRoZSB0b29sdGlwLlxuICAgKiBAbWV0aG9kIFRvb2x0aXAjaGlkZVxuICAgKiBAbWVtYmVyb2YgVG9vbHRpcFxuICAgKi9cblxuXG4gIC8qKlxuICAgKiBIaWRlcyBhbmQgZGVzdHJveXMgYW4gZWxlbWVudOKAmXMgdG9vbHRpcC5cbiAgICogQG1ldGhvZCBUb29sdGlwI2Rpc3Bvc2VcbiAgICogQG1lbWJlcm9mIFRvb2x0aXBcbiAgICovXG5cblxuICAvKipcbiAgICogVG9nZ2xlcyBhbiBlbGVtZW504oCZcyB0b29sdGlwLiBUaGlzIGlzIGNvbnNpZGVyZWQgYSDigJxtYW51YWzigJ0gdHJpZ2dlcmluZyBvZiB0aGUgdG9vbHRpcC5cbiAgICogQG1ldGhvZCBUb29sdGlwI3RvZ2dsZVxuICAgKiBAbWVtYmVyb2YgVG9vbHRpcFxuICAgKi9cblxuXG4gIC8vXG4gIC8vIERlZmF1bHRzXG4gIC8vXG5cblxuICAvL1xuICAvLyBQcml2YXRlIG1ldGhvZHNcbiAgLy9cblxuICBjcmVhdGVDbGFzcyhUb29sdGlwLCBbe1xuICAgIGtleTogJ19jcmVhdGUnLFxuXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IHRvb2x0aXAgbm9kZVxuICAgICAqIEBtZW1iZXJvZiBUb29sdGlwXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByZWZlcmVuY2VcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdGVtcGxhdGVcbiAgICAgKiBAcGFyYW0ge1N0cmluZ3xIVE1MRWxlbWVudHxUaXRsZUZ1bmN0aW9ufSB0aXRsZVxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gYWxsb3dIdG1sXG4gICAgICogQHJldHVybiB7SFRNTGVsZW1lbnR9IHRvb2x0aXBOb2RlXG4gICAgICovXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9jcmVhdGUocmVmZXJlbmNlLCB0ZW1wbGF0ZSwgdGl0bGUsIGFsbG93SHRtbCkge1xuICAgICAgLy8gY3JlYXRlIHRvb2x0aXAgZWxlbWVudFxuICAgICAgdmFyIHRvb2x0aXBHZW5lcmF0b3IgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICB0b29sdGlwR2VuZXJhdG9yLmlubmVySFRNTCA9IHRlbXBsYXRlLnRyaW0oKTtcbiAgICAgIHZhciB0b29sdGlwTm9kZSA9IHRvb2x0aXBHZW5lcmF0b3IuY2hpbGROb2Rlc1swXTtcblxuICAgICAgLy8gYWRkIHVuaXF1ZSBJRCB0byBvdXIgdG9vbHRpcCAobmVlZGVkIGZvciBhY2Nlc3NpYmlsaXR5IHJlYXNvbnMpXG4gICAgICB0b29sdGlwTm9kZS5pZCA9ICd0b29sdGlwXycgKyBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHIoMiwgMTApO1xuXG4gICAgICAvLyBzZXQgaW5pdGlhbCBgYXJpYS1oaWRkZW5gIHN0YXRlIHRvIGBmYWxzZWAgKGl0J3MgdmlzaWJsZSEpXG4gICAgICB0b29sdGlwTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyk7XG5cbiAgICAgIC8vIGFkZCB0aXRsZSB0byB0b29sdGlwXG4gICAgICB2YXIgdGl0bGVOb2RlID0gdG9vbHRpcEdlbmVyYXRvci5xdWVyeVNlbGVjdG9yKHRoaXMuaW5uZXJTZWxlY3Rvcik7XG4gICAgICBpZiAodGl0bGUubm9kZVR5cGUgPT09IDEgfHwgdGl0bGUubm9kZVR5cGUgPT09IDExKSB7XG4gICAgICAgIC8vIGlmIHRpdGxlIGlzIGEgZWxlbWVudCBub2RlIG9yIGRvY3VtZW50IGZyYWdtZW50LCBhcHBlbmQgaXQgb25seSBpZiBhbGxvd0h0bWwgaXMgdHJ1ZVxuICAgICAgICBhbGxvd0h0bWwgJiYgdGl0bGVOb2RlLmFwcGVuZENoaWxkKHRpdGxlKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNGdW5jdGlvbih0aXRsZSkpIHtcbiAgICAgICAgLy8gaWYgdGl0bGUgaXMgYSBmdW5jdGlvbiwgY2FsbCBpdCBhbmQgc2V0IGlubmVyVGV4dCBvciBpbm5lckh0bWwgZGVwZW5kaW5nIGJ5IGBhbGxvd0h0bWxgIHZhbHVlXG4gICAgICAgIHZhciB0aXRsZVRleHQgPSB0aXRsZS5jYWxsKHJlZmVyZW5jZSk7XG4gICAgICAgIGFsbG93SHRtbCA/IHRpdGxlTm9kZS5pbm5lckhUTUwgPSB0aXRsZVRleHQgOiB0aXRsZU5vZGUuaW5uZXJUZXh0ID0gdGl0bGVUZXh0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gaWYgaXQncyBqdXN0IGEgc2ltcGxlIHRleHQsIHNldCBpbm5lclRleHQgb3IgaW5uZXJIdG1sIGRlcGVuZGluZyBieSBgYWxsb3dIdG1sYCB2YWx1ZVxuICAgICAgICBhbGxvd0h0bWwgPyB0aXRsZU5vZGUuaW5uZXJIVE1MID0gdGl0bGUgOiB0aXRsZU5vZGUuaW5uZXJUZXh0ID0gdGl0bGU7XG4gICAgICB9XG5cbiAgICAgIC8vIHJldHVybiB0aGUgZ2VuZXJhdGVkIHRvb2x0aXAgbm9kZVxuICAgICAgcmV0dXJuIHRvb2x0aXBOb2RlO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ19zaG93JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gX3Nob3cocmVmZXJlbmNlLCBvcHRpb25zKSB7XG4gICAgICAvLyBkb24ndCBzaG93IGlmIGl0J3MgYWxyZWFkeSB2aXNpYmxlXG4gICAgICAvLyBvciBpZiBpdCdzIG5vdCBiZWluZyBzaG93ZWRcbiAgICAgIGlmICh0aGlzLl9pc09wZW4gJiYgIXRoaXMuX2lzT3BlbmluZykge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIHRoaXMuX2lzT3BlbiA9IHRydWU7XG5cbiAgICAgIC8vIGlmIHRoZSB0b29sdGlwTm9kZSBhbHJlYWR5IGV4aXN0cywganVzdCBzaG93IGl0XG4gICAgICBpZiAodGhpcy5fdG9vbHRpcE5vZGUpIHtcbiAgICAgICAgdGhpcy5fdG9vbHRpcE5vZGUuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgICAgICB0aGlzLl90b29sdGlwTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyk7XG4gICAgICAgIHRoaXMucG9wcGVySW5zdGFuY2UudXBkYXRlKCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfVxuXG4gICAgICAvLyBnZXQgdGl0bGVcbiAgICAgIHZhciB0aXRsZSA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoJ3RpdGxlJykgfHwgb3B0aW9ucy50aXRsZTtcblxuICAgICAgLy8gZG9uJ3Qgc2hvdyB0b29sdGlwIGlmIG5vIHRpdGxlIGlzIGRlZmluZWRcbiAgICAgIGlmICghdGl0bGUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG5cbiAgICAgIC8vIGNyZWF0ZSB0b29sdGlwIG5vZGVcbiAgICAgIHZhciB0b29sdGlwTm9kZSA9IHRoaXMuX2NyZWF0ZShyZWZlcmVuY2UsIG9wdGlvbnMudGVtcGxhdGUsIHRpdGxlLCBvcHRpb25zLmh0bWwpO1xuXG4gICAgICAvLyBBZGQgYGFyaWEtZGVzY3JpYmVkYnlgIHRvIG91ciByZWZlcmVuY2UgZWxlbWVudCBmb3IgYWNjZXNzaWJpbGl0eSByZWFzb25zXG4gICAgICByZWZlcmVuY2Uuc2V0QXR0cmlidXRlKCdhcmlhLWRlc2NyaWJlZGJ5JywgdG9vbHRpcE5vZGUuaWQpO1xuXG4gICAgICAvLyBhcHBlbmQgdG9vbHRpcCB0byBjb250YWluZXJcbiAgICAgIHZhciBjb250YWluZXIgPSB0aGlzLl9maW5kQ29udGFpbmVyKG9wdGlvbnMuY29udGFpbmVyLCByZWZlcmVuY2UpO1xuXG4gICAgICB0aGlzLl9hcHBlbmQodG9vbHRpcE5vZGUsIGNvbnRhaW5lcik7XG5cbiAgICAgIHRoaXMuX3BvcHBlck9wdGlvbnMgPSBfZXh0ZW5kcyh7fSwgb3B0aW9ucy5wb3BwZXJPcHRpb25zLCB7XG4gICAgICAgIHBsYWNlbWVudDogb3B0aW9ucy5wbGFjZW1lbnRcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9wb3BwZXJPcHRpb25zLm1vZGlmaWVycyA9IF9leHRlbmRzKHt9LCB0aGlzLl9wb3BwZXJPcHRpb25zLm1vZGlmaWVycywge1xuICAgICAgICBhcnJvdzoge1xuICAgICAgICAgIGVsZW1lbnQ6IHRoaXMuYXJyb3dTZWxlY3RvclxuICAgICAgICB9LFxuICAgICAgICBvZmZzZXQ6IHtcbiAgICAgICAgICBvZmZzZXQ6IG9wdGlvbnMub2Zmc2V0XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAob3B0aW9ucy5ib3VuZGFyaWVzRWxlbWVudCkge1xuICAgICAgICB0aGlzLl9wb3BwZXJPcHRpb25zLm1vZGlmaWVycy5wcmV2ZW50T3ZlcmZsb3cgPSB7XG4gICAgICAgICAgYm91bmRhcmllc0VsZW1lbnQ6IG9wdGlvbnMuYm91bmRhcmllc0VsZW1lbnRcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5wb3BwZXJJbnN0YW5jZSA9IG5ldyBQb3BwZXIocmVmZXJlbmNlLCB0b29sdGlwTm9kZSwgdGhpcy5fcG9wcGVyT3B0aW9ucyk7XG5cbiAgICAgIHRoaXMuX3Rvb2x0aXBOb2RlID0gdG9vbHRpcE5vZGU7XG5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ19oaWRlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gX2hpZGUoKSAvKnJlZmVyZW5jZSwgb3B0aW9ucyove1xuICAgICAgLy8gZG9uJ3QgaGlkZSBpZiBpdCdzIGFscmVhZHkgaGlkZGVuXG4gICAgICBpZiAoIXRoaXMuX2lzT3Blbikge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cblxuICAgICAgdGhpcy5faXNPcGVuID0gZmFsc2U7XG5cbiAgICAgIC8vIGhpZGUgdG9vbHRpcE5vZGVcbiAgICAgIHRoaXMuX3Rvb2x0aXBOb2RlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICB0aGlzLl90b29sdGlwTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX2Rpc3Bvc2UnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfZGlzcG9zZSgpIHtcbiAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgIC8vIHJlbW92ZSBldmVudCBsaXN0ZW5lcnMgZmlyc3QgdG8gcHJldmVudCBhbnkgdW5leHBlY3RlZCBiZWhhdmlvdXJcbiAgICAgIHRoaXMuX2V2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChfcmVmKSB7XG4gICAgICAgIHZhciBmdW5jID0gX3JlZi5mdW5jLFxuICAgICAgICAgICAgZXZlbnQgPSBfcmVmLmV2ZW50O1xuXG4gICAgICAgIF90aGlzLnJlZmVyZW5jZS5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50LCBmdW5jKTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5fZXZlbnRzID0gW107XG5cbiAgICAgIGlmICh0aGlzLl90b29sdGlwTm9kZSkge1xuICAgICAgICB0aGlzLl9oaWRlKCk7XG5cbiAgICAgICAgLy8gZGVzdHJveSBpbnN0YW5jZVxuICAgICAgICB0aGlzLnBvcHBlckluc3RhbmNlLmRlc3Ryb3koKTtcblxuICAgICAgICAvLyBkZXN0cm95IHRvb2x0aXBOb2RlIGlmIHJlbW92ZU9uRGVzdHJveSBpcyBub3Qgc2V0LCBhcyBwb3BwZXJJbnN0YW5jZS5kZXN0cm95KCkgYWxyZWFkeSByZW1vdmVzIHRoZSBlbGVtZW50XG4gICAgICAgIGlmICghdGhpcy5wb3BwZXJJbnN0YW5jZS5vcHRpb25zLnJlbW92ZU9uRGVzdHJveSkge1xuICAgICAgICAgIHRoaXMuX3Rvb2x0aXBOb2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5fdG9vbHRpcE5vZGUpO1xuICAgICAgICAgIHRoaXMuX3Rvb2x0aXBOb2RlID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX2ZpbmRDb250YWluZXInLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfZmluZENvbnRhaW5lcihjb250YWluZXIsIHJlZmVyZW5jZSkge1xuICAgICAgLy8gaWYgY29udGFpbmVyIGlzIGEgcXVlcnksIGdldCB0aGUgcmVsYXRpdmUgZWxlbWVudFxuICAgICAgaWYgKHR5cGVvZiBjb250YWluZXIgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGNvbnRhaW5lciA9IHdpbmRvdy5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKGNvbnRhaW5lcik7XG4gICAgICB9IGVsc2UgaWYgKGNvbnRhaW5lciA9PT0gZmFsc2UpIHtcbiAgICAgICAgLy8gaWYgY29udGFpbmVyIGlzIGBmYWxzZWAsIHNldCBpdCB0byByZWZlcmVuY2UgcGFyZW50XG4gICAgICAgIGNvbnRhaW5lciA9IHJlZmVyZW5jZS5wYXJlbnROb2RlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBlbmQgdG9vbHRpcCB0byBjb250YWluZXJcbiAgICAgKiBAbWVtYmVyb2YgVG9vbHRpcFxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdG9vbHRpcFxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8U3RyaW5nfGZhbHNlfSBjb250YWluZXJcbiAgICAgKi9cblxuICB9LCB7XG4gICAga2V5OiAnX2FwcGVuZCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9hcHBlbmQodG9vbHRpcE5vZGUsIGNvbnRhaW5lcikge1xuICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKHRvb2x0aXBOb2RlKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfc2V0RXZlbnRMaXN0ZW5lcnMnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfc2V0RXZlbnRMaXN0ZW5lcnMocmVmZXJlbmNlLCBldmVudHMsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBfdGhpczIgPSB0aGlzO1xuXG4gICAgICB2YXIgZGlyZWN0RXZlbnRzID0gW107XG4gICAgICB2YXIgb3Bwb3NpdGVFdmVudHMgPSBbXTtcblxuICAgICAgZXZlbnRzLmZvckVhY2goZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHN3aXRjaCAoZXZlbnQpIHtcbiAgICAgICAgICBjYXNlICdob3Zlcic6XG4gICAgICAgICAgICBkaXJlY3RFdmVudHMucHVzaCgnbW91c2VlbnRlcicpO1xuICAgICAgICAgICAgb3Bwb3NpdGVFdmVudHMucHVzaCgnbW91c2VsZWF2ZScpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnZm9jdXMnOlxuICAgICAgICAgICAgZGlyZWN0RXZlbnRzLnB1c2goJ2ZvY3VzJyk7XG4gICAgICAgICAgICBvcHBvc2l0ZUV2ZW50cy5wdXNoKCdibHVyJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdjbGljayc6XG4gICAgICAgICAgICBkaXJlY3RFdmVudHMucHVzaCgnY2xpY2snKTtcbiAgICAgICAgICAgIG9wcG9zaXRlRXZlbnRzLnB1c2goJ2NsaWNrJyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIHNjaGVkdWxlIHNob3cgdG9vbHRpcFxuICAgICAgZGlyZWN0RXZlbnRzLmZvckVhY2goZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHZhciBmdW5jID0gZnVuY3Rpb24gZnVuYyhldnQpIHtcbiAgICAgICAgICBpZiAoX3RoaXMyLl9pc09wZW5pbmcgPT09IHRydWUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgZXZ0LnVzZWRCeVRvb2x0aXAgPSB0cnVlO1xuICAgICAgICAgIF90aGlzMi5fc2NoZWR1bGVTaG93KHJlZmVyZW5jZSwgb3B0aW9ucy5kZWxheSwgb3B0aW9ucywgZXZ0KTtcbiAgICAgICAgfTtcbiAgICAgICAgX3RoaXMyLl9ldmVudHMucHVzaCh7IGV2ZW50OiBldmVudCwgZnVuYzogZnVuYyB9KTtcbiAgICAgICAgcmVmZXJlbmNlLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGZ1bmMpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIHNjaGVkdWxlIGhpZGUgdG9vbHRpcFxuICAgICAgb3Bwb3NpdGVFdmVudHMuZm9yRWFjaChmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgdmFyIGZ1bmMgPSBmdW5jdGlvbiBmdW5jKGV2dCkge1xuICAgICAgICAgIGlmIChldnQudXNlZEJ5VG9vbHRpcCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBfdGhpczIuX3NjaGVkdWxlSGlkZShyZWZlcmVuY2UsIG9wdGlvbnMuZGVsYXksIG9wdGlvbnMsIGV2dCk7XG4gICAgICAgIH07XG4gICAgICAgIF90aGlzMi5fZXZlbnRzLnB1c2goeyBldmVudDogZXZlbnQsIGZ1bmM6IGZ1bmMgfSk7XG4gICAgICAgIHJlZmVyZW5jZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBmdW5jKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ19zY2hlZHVsZVNob3cnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfc2NoZWR1bGVTaG93KHJlZmVyZW5jZSwgZGVsYXksIG9wdGlvbnMgLyosIGV2dCAqLykge1xuICAgICAgdmFyIF90aGlzMyA9IHRoaXM7XG5cbiAgICAgIHRoaXMuX2lzT3BlbmluZyA9IHRydWU7XG4gICAgICAvLyBkZWZhdWx0cyB0byAwXG4gICAgICB2YXIgY29tcHV0ZWREZWxheSA9IGRlbGF5ICYmIGRlbGF5LnNob3cgfHwgZGVsYXkgfHwgMDtcbiAgICAgIHRoaXMuX3Nob3dUaW1lb3V0ID0gd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gX3RoaXMzLl9zaG93KHJlZmVyZW5jZSwgb3B0aW9ucyk7XG4gICAgICB9LCBjb21wdXRlZERlbGF5KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfc2NoZWR1bGVIaWRlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gX3NjaGVkdWxlSGlkZShyZWZlcmVuY2UsIGRlbGF5LCBvcHRpb25zLCBldnQpIHtcbiAgICAgIHZhciBfdGhpczQgPSB0aGlzO1xuXG4gICAgICB0aGlzLl9pc09wZW5pbmcgPSBmYWxzZTtcbiAgICAgIC8vIGRlZmF1bHRzIHRvIDBcbiAgICAgIHZhciBjb21wdXRlZERlbGF5ID0gZGVsYXkgJiYgZGVsYXkuaGlkZSB8fCBkZWxheSB8fCAwO1xuICAgICAgd2luZG93LnNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KF90aGlzNC5fc2hvd1RpbWVvdXQpO1xuICAgICAgICBpZiAoX3RoaXM0Ll9pc09wZW4gPT09IGZhbHNlKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghZG9jdW1lbnQuYm9keS5jb250YWlucyhfdGhpczQuX3Rvb2x0aXBOb2RlKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHdlIGFyZSBoaWRpbmcgYmVjYXVzZSBvZiBhIG1vdXNlbGVhdmUsIHdlIG11c3QgY2hlY2sgdGhhdCB0aGUgbmV3XG4gICAgICAgIC8vIHJlZmVyZW5jZSBpc24ndCB0aGUgdG9vbHRpcCwgYmVjYXVzZSBpbiB0aGlzIGNhc2Ugd2UgZG9uJ3Qgd2FudCB0byBoaWRlIGl0XG4gICAgICAgIGlmIChldnQudHlwZSA9PT0gJ21vdXNlbGVhdmUnKSB7XG4gICAgICAgICAgdmFyIGlzU2V0ID0gX3RoaXM0Ll9zZXRUb29sdGlwTm9kZUV2ZW50KGV2dCwgcmVmZXJlbmNlLCBkZWxheSwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAvLyBpZiB3ZSBzZXQgdGhlIG5ldyBldmVudCwgZG9uJ3QgaGlkZSB0aGUgdG9vbHRpcCB5ZXRcbiAgICAgICAgICAvLyB0aGUgbmV3IGV2ZW50IHdpbGwgdGFrZSBjYXJlIHRvIGhpZGUgaXQgaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgaWYgKGlzU2V0KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgX3RoaXM0Ll9oaWRlKHJlZmVyZW5jZSwgb3B0aW9ucyk7XG4gICAgICB9LCBjb21wdXRlZERlbGF5KTtcbiAgICB9XG4gIH1dKTtcbiAgcmV0dXJuIFRvb2x0aXA7XG59KCk7XG5cbi8qKlxuICogUGxhY2VtZW50IGZ1bmN0aW9uLCBpdHMgY29udGV4dCBpcyB0aGUgVG9vbHRpcCBpbnN0YW5jZS5cbiAqIEBtZW1iZXJvZiBUb29sdGlwXG4gKiBAY2FsbGJhY2sgUGxhY2VtZW50RnVuY3Rpb25cbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRvb2x0aXAgLSB0b29sdGlwIERPTSBub2RlLlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcmVmZXJlbmNlIC0gcmVmZXJlbmNlIERPTSBub2RlLlxuICogQHJldHVybiB7U3RyaW5nfSBwbGFjZW1lbnQgLSBPbmUgb2YgdGhlIGFsbG93ZWQgcGxhY2VtZW50IG9wdGlvbnMuXG4gKi9cblxuLyoqXG4gKiBUaXRsZSBmdW5jdGlvbiwgaXRzIGNvbnRleHQgaXMgdGhlIFRvb2x0aXAgaW5zdGFuY2UuXG4gKiBAbWVtYmVyb2YgVG9vbHRpcFxuICogQGNhbGxiYWNrIFRpdGxlRnVuY3Rpb25cbiAqIEByZXR1cm4ge1N0cmluZ30gcGxhY2VtZW50IC0gVGhlIGRlc2lyZWQgdGl0bGUuXG4gKi9cblxuXG52YXIgX2luaXRpYWxpc2VQcm9wcyA9IGZ1bmN0aW9uIF9pbml0aWFsaXNlUHJvcHMoKSB7XG4gIHZhciBfdGhpczUgPSB0aGlzO1xuXG4gIHRoaXMuc2hvdyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gX3RoaXM1Ll9zaG93KF90aGlzNS5yZWZlcmVuY2UsIF90aGlzNS5vcHRpb25zKTtcbiAgfTtcblxuICB0aGlzLmhpZGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIF90aGlzNS5faGlkZSgpO1xuICB9O1xuXG4gIHRoaXMuZGlzcG9zZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gX3RoaXM1Ll9kaXNwb3NlKCk7XG4gIH07XG5cbiAgdGhpcy50b2dnbGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKF90aGlzNS5faXNPcGVuKSB7XG4gICAgICByZXR1cm4gX3RoaXM1LmhpZGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIF90aGlzNS5zaG93KCk7XG4gICAgfVxuICB9O1xuXG4gIHRoaXMuYXJyb3dTZWxlY3RvciA9ICcudG9vbHRpcC1hcnJvdywgLnRvb2x0aXBfX2Fycm93JztcbiAgdGhpcy5pbm5lclNlbGVjdG9yID0gJy50b29sdGlwLWlubmVyLCAudG9vbHRpcF9faW5uZXInO1xuICB0aGlzLl9ldmVudHMgPSBbXTtcblxuICB0aGlzLl9zZXRUb29sdGlwTm9kZUV2ZW50ID0gZnVuY3Rpb24gKGV2dCwgcmVmZXJlbmNlLCBkZWxheSwgb3B0aW9ucykge1xuICAgIHZhciByZWxhdGVkcmVmZXJlbmNlID0gZXZ0LnJlbGF0ZWRyZWZlcmVuY2UgfHwgZXZ0LnRvRWxlbWVudCB8fCBldnQucmVsYXRlZFRhcmdldDtcblxuICAgIHZhciBjYWxsYmFjayA9IGZ1bmN0aW9uIGNhbGxiYWNrKGV2dDIpIHtcbiAgICAgIHZhciByZWxhdGVkcmVmZXJlbmNlMiA9IGV2dDIucmVsYXRlZHJlZmVyZW5jZSB8fCBldnQyLnRvRWxlbWVudCB8fCBldnQyLnJlbGF0ZWRUYXJnZXQ7XG5cbiAgICAgIC8vIFJlbW92ZSBldmVudCBsaXN0ZW5lciBhZnRlciBjYWxsXG4gICAgICBfdGhpczUuX3Rvb2x0aXBOb2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZ0LnR5cGUsIGNhbGxiYWNrKTtcblxuICAgICAgLy8gSWYgdGhlIG5ldyByZWZlcmVuY2UgaXMgbm90IHRoZSByZWZlcmVuY2UgZWxlbWVudFxuICAgICAgaWYgKCFyZWZlcmVuY2UuY29udGFpbnMocmVsYXRlZHJlZmVyZW5jZTIpKSB7XG4gICAgICAgIC8vIFNjaGVkdWxlIHRvIGhpZGUgdG9vbHRpcFxuICAgICAgICBfdGhpczUuX3NjaGVkdWxlSGlkZShyZWZlcmVuY2UsIG9wdGlvbnMuZGVsYXksIG9wdGlvbnMsIGV2dDIpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoX3RoaXM1Ll90b29sdGlwTm9kZS5jb250YWlucyhyZWxhdGVkcmVmZXJlbmNlKSkge1xuICAgICAgLy8gbGlzdGVuIHRvIG1vdXNlbGVhdmUgb24gdGhlIHRvb2x0aXAgZWxlbWVudCB0byBiZSBhYmxlIHRvIGhpZGUgdGhlIHRvb2x0aXBcbiAgICAgIF90aGlzNS5fdG9vbHRpcE5vZGUuYWRkRXZlbnRMaXN0ZW5lcihldnQudHlwZSwgY2FsbGJhY2spO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9O1xufTtcblxucmV0dXJuIFRvb2x0aXA7XG5cbn0pKSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10b29sdGlwLmpzLm1hcFxuIiwiLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vIGZhbmN5Qm94IHYzLjMuNVxuLy9cbi8vIExpY2Vuc2VkIEdQTHYzIGZvciBvcGVuIHNvdXJjZSB1c2Vcbi8vIG9yIGZhbmN5Qm94IENvbW1lcmNpYWwgTGljZW5zZSBmb3IgY29tbWVyY2lhbCB1c2Vcbi8vXG4vLyBodHRwOi8vZmFuY3lhcHBzLmNvbS9mYW5jeWJveC9cbi8vIENvcHlyaWdodCAyMDE4IGZhbmN5QXBwc1xuLy9cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4oZnVuY3Rpb24od2luZG93LCBkb2N1bWVudCwgJCwgdW5kZWZpbmVkKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHdpbmRvdy5jb25zb2xlID0gd2luZG93LmNvbnNvbGUgfHwge1xuICAgIGluZm86IGZ1bmN0aW9uKHN0dWZmKSB7fVxuICB9O1xuXG4gIC8vIElmIHRoZXJlJ3Mgbm8galF1ZXJ5LCBmYW5jeUJveCBjYW4ndCB3b3JrXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgaWYgKCEkKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gQ2hlY2sgaWYgZmFuY3lCb3ggaXMgYWxyZWFkeSBpbml0aWFsaXplZFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgaWYgKCQuZm4uZmFuY3lib3gpIHtcbiAgICBjb25zb2xlLmluZm8oXCJmYW5jeUJveCBhbHJlYWR5IGluaXRpYWxpemVkXCIpO1xuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gUHJpdmF0ZSBkZWZhdWx0IHNldHRpbmdzXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gIHZhciBkZWZhdWx0cyA9IHtcbiAgICAvLyBFbmFibGUgaW5maW5pdGUgZ2FsbGVyeSBuYXZpZ2F0aW9uXG4gICAgbG9vcDogZmFsc2UsXG5cbiAgICAvLyBIb3Jpem9udGFsIHNwYWNlIGJldHdlZW4gc2xpZGVzXG4gICAgZ3V0dGVyOiA1MCxcblxuICAgIC8vIEVuYWJsZSBrZXlib2FyZCBuYXZpZ2F0aW9uXG4gICAga2V5Ym9hcmQ6IHRydWUsXG5cbiAgICAvLyBTaG91bGQgZGlzcGxheSBuYXZpZ2F0aW9uIGFycm93cyBhdCB0aGUgc2NyZWVuIGVkZ2VzXG4gICAgYXJyb3dzOiB0cnVlLFxuXG4gICAgLy8gU2hvdWxkIGRpc3BsYXkgY291bnRlciBhdCB0aGUgdG9wIGxlZnQgY29ybmVyXG4gICAgaW5mb2JhcjogdHJ1ZSxcblxuICAgIC8vIFNob3VsZCBkaXNwbGF5IGNsb3NlIGJ1dHRvbiAodXNpbmcgYGJ0blRwbC5zbWFsbEJ0bmAgdGVtcGxhdGUpIG92ZXIgdGhlIGNvbnRlbnRcbiAgICAvLyBDYW4gYmUgdHJ1ZSwgZmFsc2UsIFwiYXV0b1wiXG4gICAgLy8gSWYgXCJhdXRvXCIgLSB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgZW5hYmxlZCBmb3IgXCJodG1sXCIsIFwiaW5saW5lXCIgb3IgXCJhamF4XCIgaXRlbXNcbiAgICBzbWFsbEJ0bjogXCJhdXRvXCIsXG5cbiAgICAvLyBTaG91bGQgZGlzcGxheSB0b29sYmFyIChidXR0b25zIGF0IHRoZSB0b3ApXG4gICAgLy8gQ2FuIGJlIHRydWUsIGZhbHNlLCBcImF1dG9cIlxuICAgIC8vIElmIFwiYXV0b1wiIC0gd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGhpZGRlbiBpZiBcInNtYWxsQnRuXCIgaXMgZW5hYmxlZFxuICAgIHRvb2xiYXI6IFwiYXV0b1wiLFxuXG4gICAgLy8gV2hhdCBidXR0b25zIHNob3VsZCBhcHBlYXIgaW4gdGhlIHRvcCByaWdodCBjb3JuZXIuXG4gICAgLy8gQnV0dG9ucyB3aWxsIGJlIGNyZWF0ZWQgdXNpbmcgdGVtcGxhdGVzIGZyb20gYGJ0blRwbGAgb3B0aW9uXG4gICAgLy8gYW5kIHRoZXkgd2lsbCBiZSBwbGFjZWQgaW50byB0b29sYmFyIChjbGFzcz1cImZhbmN5Ym94LXRvb2xiYXJcImAgZWxlbWVudClcbiAgICBidXR0b25zOiBbXG4gICAgICBcInpvb21cIixcbiAgICAgIC8vXCJzaGFyZVwiLFxuICAgICAgLy9cInNsaWRlU2hvd1wiLFxuICAgICAgLy9cImZ1bGxTY3JlZW5cIixcbiAgICAgIC8vXCJkb3dubG9hZFwiLFxuICAgICAgXCJ0aHVtYnNcIixcbiAgICAgIFwiY2xvc2VcIlxuICAgIF0sXG5cbiAgICAvLyBEZXRlY3QgXCJpZGxlXCIgdGltZSBpbiBzZWNvbmRzXG4gICAgaWRsZVRpbWU6IDMsXG5cbiAgICAvLyBEaXNhYmxlIHJpZ2h0LWNsaWNrIGFuZCB1c2Ugc2ltcGxlIGltYWdlIHByb3RlY3Rpb24gZm9yIGltYWdlc1xuICAgIHByb3RlY3Q6IGZhbHNlLFxuXG4gICAgLy8gU2hvcnRjdXQgdG8gbWFrZSBjb250ZW50IFwibW9kYWxcIiAtIGRpc2FibGUga2V5Ym9hcmQgbmF2aWd0aW9uLCBoaWRlIGJ1dHRvbnMsIGV0Y1xuICAgIG1vZGFsOiBmYWxzZSxcblxuICAgIGltYWdlOiB7XG4gICAgICAvLyBXYWl0IGZvciBpbWFnZXMgdG8gbG9hZCBiZWZvcmUgZGlzcGxheWluZ1xuICAgICAgLy8gICB0cnVlICAtIHdhaXQgZm9yIGltYWdlIHRvIGxvYWQgYW5kIHRoZW4gZGlzcGxheTtcbiAgICAgIC8vICAgZmFsc2UgLSBkaXNwbGF5IHRodW1ibmFpbCBhbmQgbG9hZCB0aGUgZnVsbC1zaXplZCBpbWFnZSBvdmVyIHRvcCxcbiAgICAgIC8vICAgICAgICAgICByZXF1aXJlcyBwcmVkZWZpbmVkIGltYWdlIGRpbWVuc2lvbnMgKGBkYXRhLXdpZHRoYCBhbmQgYGRhdGEtaGVpZ2h0YCBhdHRyaWJ1dGVzKVxuICAgICAgcHJlbG9hZDogZmFsc2VcbiAgICB9LFxuXG4gICAgYWpheDoge1xuICAgICAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgc2V0dGluZ3MgZm9yIGFqYXggcmVxdWVzdFxuICAgICAgc2V0dGluZ3M6IHtcbiAgICAgICAgLy8gVGhpcyBoZWxwcyB0byBpbmRpY2F0ZSB0aGF0IHJlcXVlc3QgY29tZXMgZnJvbSB0aGUgbW9kYWxcbiAgICAgICAgLy8gRmVlbCBmcmVlIHRvIGNoYW5nZSBuYW1pbmdcbiAgICAgICAgZGF0YToge1xuICAgICAgICAgIGZhbmN5Ym94OiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgaWZyYW1lOiB7XG4gICAgICAvLyBJZnJhbWUgdGVtcGxhdGVcbiAgICAgIHRwbDpcbiAgICAgICAgJzxpZnJhbWUgaWQ9XCJmYW5jeWJveC1mcmFtZXtybmR9XCIgbmFtZT1cImZhbmN5Ym94LWZyYW1le3JuZH1cIiBjbGFzcz1cImZhbmN5Ym94LWlmcmFtZVwiIGZyYW1lYm9yZGVyPVwiMFwiIHZzcGFjZT1cIjBcIiBoc3BhY2U9XCIwXCIgd2Via2l0QWxsb3dGdWxsU2NyZWVuIG1vemFsbG93ZnVsbHNjcmVlbiBhbGxvd0Z1bGxTY3JlZW4gYWxsb3d0cmFuc3BhcmVuY3k9XCJ0cnVlXCIgc3JjPVwiXCI+PC9pZnJhbWU+JyxcblxuICAgICAgLy8gUHJlbG9hZCBpZnJhbWUgYmVmb3JlIGRpc3BsYXlpbmcgaXRcbiAgICAgIC8vIFRoaXMgYWxsb3dzIHRvIGNhbGN1bGF0ZSBpZnJhbWUgY29udGVudCB3aWR0aCBhbmQgaGVpZ2h0XG4gICAgICAvLyAobm90ZTogRHVlIHRvIFwiU2FtZSBPcmlnaW4gUG9saWN5XCIsIHlvdSBjYW4ndCBnZXQgY3Jvc3MgZG9tYWluIGRhdGEpLlxuICAgICAgcHJlbG9hZDogdHJ1ZSxcblxuICAgICAgLy8gQ3VzdG9tIENTUyBzdHlsaW5nIGZvciBpZnJhbWUgd3JhcHBpbmcgZWxlbWVudFxuICAgICAgLy8gWW91IGNhbiB1c2UgdGhpcyB0byBzZXQgY3VzdG9tIGlmcmFtZSBkaW1lbnNpb25zXG4gICAgICBjc3M6IHt9LFxuXG4gICAgICAvLyBJZnJhbWUgdGFnIGF0dHJpYnV0ZXNcbiAgICAgIGF0dHI6IHtcbiAgICAgICAgc2Nyb2xsaW5nOiBcImF1dG9cIlxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyBEZWZhdWx0IGNvbnRlbnQgdHlwZSBpZiBjYW5ub3QgYmUgZGV0ZWN0ZWQgYXV0b21hdGljYWxseVxuICAgIGRlZmF1bHRUeXBlOiBcImltYWdlXCIsXG5cbiAgICAvLyBPcGVuL2Nsb3NlIGFuaW1hdGlvbiB0eXBlXG4gICAgLy8gUG9zc2libGUgdmFsdWVzOlxuICAgIC8vICAgZmFsc2UgICAgICAgICAgICAtIGRpc2FibGVcbiAgICAvLyAgIFwiem9vbVwiICAgICAgICAgICAtIHpvb20gaW1hZ2VzIGZyb20vdG8gdGh1bWJuYWlsXG4gICAgLy8gICBcImZhZGVcIlxuICAgIC8vICAgXCJ6b29tLWluLW91dFwiXG4gICAgLy9cbiAgICBhbmltYXRpb25FZmZlY3Q6IFwiem9vbVwiLFxuXG4gICAgLy8gRHVyYXRpb24gaW4gbXMgZm9yIG9wZW4vY2xvc2UgYW5pbWF0aW9uXG4gICAgYW5pbWF0aW9uRHVyYXRpb246IDM2NixcblxuICAgIC8vIFNob3VsZCBpbWFnZSBjaGFuZ2Ugb3BhY2l0eSB3aGlsZSB6b29taW5nXG4gICAgLy8gSWYgb3BhY2l0eSBpcyBcImF1dG9cIiwgdGhlbiBvcGFjaXR5IHdpbGwgYmUgY2hhbmdlZCBpZiBpbWFnZSBhbmQgdGh1bWJuYWlsIGhhdmUgZGlmZmVyZW50IGFzcGVjdCByYXRpb3NcbiAgICB6b29tT3BhY2l0eTogXCJhdXRvXCIsXG5cbiAgICAvLyBUcmFuc2l0aW9uIGVmZmVjdCBiZXR3ZWVuIHNsaWRlc1xuICAgIC8vXG4gICAgLy8gUG9zc2libGUgdmFsdWVzOlxuICAgIC8vICAgZmFsc2UgICAgICAgICAgICAtIGRpc2FibGVcbiAgICAvLyAgIFwiZmFkZSdcbiAgICAvLyAgIFwic2xpZGUnXG4gICAgLy8gICBcImNpcmN1bGFyJ1xuICAgIC8vICAgXCJ0dWJlJ1xuICAgIC8vICAgXCJ6b29tLWluLW91dCdcbiAgICAvLyAgIFwicm90YXRlJ1xuICAgIC8vXG4gICAgdHJhbnNpdGlvbkVmZmVjdDogXCJmYWRlXCIsXG5cbiAgICAvLyBEdXJhdGlvbiBpbiBtcyBmb3IgdHJhbnNpdGlvbiBhbmltYXRpb25cbiAgICB0cmFuc2l0aW9uRHVyYXRpb246IDM2NixcblxuICAgIC8vIEN1c3RvbSBDU1MgY2xhc3MgZm9yIHNsaWRlIGVsZW1lbnRcbiAgICBzbGlkZUNsYXNzOiBcIlwiLFxuXG4gICAgLy8gQ3VzdG9tIENTUyBjbGFzcyBmb3IgbGF5b3V0XG4gICAgYmFzZUNsYXNzOiBcIlwiLFxuXG4gICAgLy8gQmFzZSB0ZW1wbGF0ZSBmb3IgbGF5b3V0XG4gICAgYmFzZVRwbDpcbiAgICAgICc8ZGl2IGNsYXNzPVwiZmFuY3lib3gtY29udGFpbmVyXCIgcm9sZT1cImRpYWxvZ1wiIHRhYmluZGV4PVwiLTFcIj4nICtcbiAgICAgICc8ZGl2IGNsYXNzPVwiZmFuY3lib3gtYmdcIj48L2Rpdj4nICtcbiAgICAgICc8ZGl2IGNsYXNzPVwiZmFuY3lib3gtaW5uZXJcIj4nICtcbiAgICAgICc8ZGl2IGNsYXNzPVwiZmFuY3lib3gtaW5mb2JhclwiPicgK1xuICAgICAgXCI8c3BhbiBkYXRhLWZhbmN5Ym94LWluZGV4Pjwvc3Bhbj4mbmJzcDsvJm5ic3A7PHNwYW4gZGF0YS1mYW5jeWJveC1jb3VudD48L3NwYW4+XCIgK1xuICAgICAgXCI8L2Rpdj5cIiArXG4gICAgICAnPGRpdiBjbGFzcz1cImZhbmN5Ym94LXRvb2xiYXJcIj57e2J1dHRvbnN9fTwvZGl2PicgK1xuICAgICAgJzxkaXYgY2xhc3M9XCJmYW5jeWJveC1uYXZpZ2F0aW9uXCI+e3thcnJvd3N9fTwvZGl2PicgK1xuICAgICAgJzxkaXYgY2xhc3M9XCJmYW5jeWJveC1zdGFnZVwiPjwvZGl2PicgK1xuICAgICAgJzxkaXYgY2xhc3M9XCJmYW5jeWJveC1jYXB0aW9uXCI+PC9kaXY+JyArXG4gICAgICBcIjwvZGl2PlwiICtcbiAgICAgIFwiPC9kaXY+XCIsXG5cbiAgICAvLyBMb2FkaW5nIGluZGljYXRvciB0ZW1wbGF0ZVxuICAgIHNwaW5uZXJUcGw6ICc8ZGl2IGNsYXNzPVwiZmFuY3lib3gtbG9hZGluZ1wiPjwvZGl2PicsXG5cbiAgICAvLyBFcnJvciBtZXNzYWdlIHRlbXBsYXRlXG4gICAgZXJyb3JUcGw6ICc8ZGl2IGNsYXNzPVwiZmFuY3lib3gtZXJyb3JcIj48cD57e0VSUk9SfX08L3A+PC9kaXY+JyxcblxuICAgIGJ0blRwbDoge1xuICAgICAgZG93bmxvYWQ6XG4gICAgICAgICc8YSBkb3dubG9hZCBkYXRhLWZhbmN5Ym94LWRvd25sb2FkIGNsYXNzPVwiZmFuY3lib3gtYnV0dG9uIGZhbmN5Ym94LWJ1dHRvbi0tZG93bmxvYWRcIiB0aXRsZT1cInt7RE9XTkxPQUR9fVwiIGhyZWY9XCJqYXZhc2NyaXB0OjtcIj4nICtcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIjAgMCA0MCA0MFwiPicgK1xuICAgICAgICAnPHBhdGggZD1cIk0xMywxNiBMMjAsMjMgTDI3LDE2IE0yMCw3IEwyMCwyMyBNMTAsMjQgTDEwLDI4IEwzMCwyOCBMMzAsMjRcIiAvPicgK1xuICAgICAgICBcIjwvc3ZnPlwiICtcbiAgICAgICAgXCI8L2E+XCIsXG5cbiAgICAgIHpvb206XG4gICAgICAgICc8YnV0dG9uIGRhdGEtZmFuY3lib3gtem9vbSBjbGFzcz1cImZhbmN5Ym94LWJ1dHRvbiBmYW5jeWJveC1idXR0b24tLXpvb21cIiB0aXRsZT1cInt7Wk9PTX19XCI+JyArXG4gICAgICAgICc8c3ZnIHZpZXdCb3g9XCIwIDAgNDAgNDBcIj4nICtcbiAgICAgICAgJzxwYXRoIGQ9XCJNMTgsMTcgbS04LDAgYTgsOCAwIDEsMCAxNiwwIGE4LDggMCAxLDAgLTE2LDAgTTI0LDIyIEwzMSwyOVwiIC8+JyArXG4gICAgICAgIFwiPC9zdmc+XCIgK1xuICAgICAgICBcIjwvYnV0dG9uPlwiLFxuXG4gICAgICBjbG9zZTpcbiAgICAgICAgJzxidXR0b24gZGF0YS1mYW5jeWJveC1jbG9zZSBjbGFzcz1cImZhbmN5Ym94LWJ1dHRvbiBmYW5jeWJveC1idXR0b24tLWNsb3NlXCIgdGl0bGU9XCJ7e0NMT1NFfX1cIj4nICtcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIjAgMCA0MCA0MFwiPicgK1xuICAgICAgICAnPHBhdGggZD1cIk0xMCwxMCBMMzAsMzAgTTMwLDEwIEwxMCwzMFwiIC8+JyArXG4gICAgICAgIFwiPC9zdmc+XCIgK1xuICAgICAgICBcIjwvYnV0dG9uPlwiLFxuXG4gICAgICAvLyBUaGlzIHNtYWxsIGNsb3NlIGJ1dHRvbiB3aWxsIGJlIGFwcGVuZGVkIHRvIHlvdXIgaHRtbC9pbmxpbmUvYWpheCBjb250ZW50IGJ5IGRlZmF1bHQsXG4gICAgICAvLyBpZiBcInNtYWxsQnRuXCIgb3B0aW9uIGlzIG5vdCBzZXQgdG8gZmFsc2VcbiAgICAgIHNtYWxsQnRuOlxuICAgICAgICAnPGJ1dHRvbiBkYXRhLWZhbmN5Ym94LWNsb3NlIGNsYXNzPVwiZmFuY3lib3gtY2xvc2Utc21hbGxcIiB0aXRsZT1cInt7Q0xPU0V9fVwiPjxzdmcgdmlld0JveD1cIjAgMCAzMiAzMlwiPjxwYXRoIGQ9XCJNMTAsMTAgTDIyLDIyIE0yMiwxMCBMMTAsMjJcIj48L3BhdGg+PC9zdmc+PC9idXR0b24+JyxcblxuICAgICAgLy8gQXJyb3dzXG4gICAgICBhcnJvd0xlZnQ6XG4gICAgICAgICc8YSBkYXRhLWZhbmN5Ym94LXByZXYgY2xhc3M9XCJmYW5jeWJveC1idXR0b24gZmFuY3lib3gtYnV0dG9uLS1hcnJvd19sZWZ0XCIgdGl0bGU9XCJ7e1BSRVZ9fVwiIGhyZWY9XCJqYXZhc2NyaXB0OjtcIj4nICtcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIjAgMCA0MCA0MFwiPicgK1xuICAgICAgICAnPHBhdGggZD1cIk0xOCwxMiBMMTAsMjAgTDE4LDI4IE0xMCwyMCBMMzAsMjBcIj48L3BhdGg+JyArXG4gICAgICAgIFwiPC9zdmc+XCIgK1xuICAgICAgICBcIjwvYT5cIixcblxuICAgICAgYXJyb3dSaWdodDpcbiAgICAgICAgJzxhIGRhdGEtZmFuY3lib3gtbmV4dCBjbGFzcz1cImZhbmN5Ym94LWJ1dHRvbiBmYW5jeWJveC1idXR0b24tLWFycm93X3JpZ2h0XCIgdGl0bGU9XCJ7e05FWFR9fVwiIGhyZWY9XCJqYXZhc2NyaXB0OjtcIj4nICtcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIjAgMCA0MCA0MFwiPicgK1xuICAgICAgICAnPHBhdGggZD1cIk0xMCwyMCBMMzAsMjAgTTIyLDEyIEwzMCwyMCBMMjIsMjhcIj48L3BhdGg+JyArXG4gICAgICAgIFwiPC9zdmc+XCIgK1xuICAgICAgICBcIjwvYT5cIlxuICAgIH0sXG5cbiAgICAvLyBDb250YWluZXIgaXMgaW5qZWN0ZWQgaW50byB0aGlzIGVsZW1lbnRcbiAgICBwYXJlbnRFbDogXCJib2R5XCIsXG5cbiAgICAvLyBGb2N1cyBoYW5kbGluZ1xuICAgIC8vID09PT09PT09PT09PT09XG5cbiAgICAvLyBUcnkgdG8gZm9jdXMgb24gdGhlIGZpcnN0IGZvY3VzYWJsZSBlbGVtZW50IGFmdGVyIG9wZW5pbmdcbiAgICBhdXRvRm9jdXM6IGZhbHNlLFxuXG4gICAgLy8gUHV0IGZvY3VzIGJhY2sgdG8gYWN0aXZlIGVsZW1lbnQgYWZ0ZXIgY2xvc2luZ1xuICAgIGJhY2tGb2N1czogdHJ1ZSxcblxuICAgIC8vIERvIG5vdCBsZXQgdXNlciB0byBmb2N1cyBvbiBlbGVtZW50IG91dHNpZGUgbW9kYWwgY29udGVudFxuICAgIHRyYXBGb2N1czogdHJ1ZSxcblxuICAgIC8vIE1vZHVsZSBzcGVjaWZpYyBvcHRpb25zXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGZ1bGxTY3JlZW46IHtcbiAgICAgIGF1dG9TdGFydDogZmFsc2VcbiAgICB9LFxuXG4gICAgLy8gU2V0IGB0b3VjaDogZmFsc2VgIHRvIGRpc2FibGUgZHJhZ2dpbmcvc3dpcGluZ1xuICAgIHRvdWNoOiB7XG4gICAgICB2ZXJ0aWNhbDogdHJ1ZSwgLy8gQWxsb3cgdG8gZHJhZyBjb250ZW50IHZlcnRpY2FsbHlcbiAgICAgIG1vbWVudHVtOiB0cnVlIC8vIENvbnRpbnVlIG1vdmVtZW50IGFmdGVyIHJlbGVhc2luZyBtb3VzZS90b3VjaCB3aGVuIHBhbm5pbmdcbiAgICB9LFxuXG4gICAgLy8gSGFzaCB2YWx1ZSB3aGVuIGluaXRpYWxpemluZyBtYW51YWxseSxcbiAgICAvLyBzZXQgYGZhbHNlYCB0byBkaXNhYmxlIGhhc2ggY2hhbmdlXG4gICAgaGFzaDogbnVsbCxcblxuICAgIC8vIEN1c3RvbWl6ZSBvciBhZGQgbmV3IG1lZGlhIHR5cGVzXG4gICAgLy8gRXhhbXBsZTpcbiAgICAvKlxuICAgICAgICBtZWRpYSA6IHtcbiAgICAgICAgICAgIHlvdXR1YmUgOiB7XG4gICAgICAgICAgICAgICAgcGFyYW1zIDoge1xuICAgICAgICAgICAgICAgICAgICBhdXRvcGxheSA6IDBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgKi9cbiAgICBtZWRpYToge30sXG5cbiAgICBzbGlkZVNob3c6IHtcbiAgICAgIGF1dG9TdGFydDogZmFsc2UsXG4gICAgICBzcGVlZDogNDAwMFxuICAgIH0sXG5cbiAgICB0aHVtYnM6IHtcbiAgICAgIGF1dG9TdGFydDogZmFsc2UsIC8vIERpc3BsYXkgdGh1bWJuYWlscyBvbiBvcGVuaW5nXG4gICAgICBoaWRlT25DbG9zZTogdHJ1ZSwgLy8gSGlkZSB0aHVtYm5haWwgZ3JpZCB3aGVuIGNsb3NpbmcgYW5pbWF0aW9uIHN0YXJ0c1xuICAgICAgcGFyZW50RWw6IFwiLmZhbmN5Ym94LWNvbnRhaW5lclwiLCAvLyBDb250YWluZXIgaXMgaW5qZWN0ZWQgaW50byB0aGlzIGVsZW1lbnRcbiAgICAgIGF4aXM6IFwieVwiIC8vIFZlcnRpY2FsICh5KSBvciBob3Jpem9udGFsICh4KSBzY3JvbGxpbmdcbiAgICB9LFxuXG4gICAgLy8gVXNlIG1vdXNld2hlZWwgdG8gbmF2aWdhdGUgZ2FsbGVyeVxuICAgIC8vIElmICdhdXRvJyAtIGVuYWJsZWQgZm9yIGltYWdlcyBvbmx5XG4gICAgd2hlZWw6IFwiYXV0b1wiLFxuXG4gICAgLy8gQ2FsbGJhY2tzXG4gICAgLy89PT09PT09PT09XG5cbiAgICAvLyBTZWUgRG9jdW1lbnRhdGlvbi9BUEkvRXZlbnRzIGZvciBtb3JlIGluZm9ybWF0aW9uXG4gICAgLy8gRXhhbXBsZTpcbiAgICAvKlxuXHRcdGFmdGVyU2hvdzogZnVuY3Rpb24oIGluc3RhbmNlLCBjdXJyZW50ICkge1xuXHRcdFx0Y29uc29sZS5pbmZvKCAnQ2xpY2tlZCBlbGVtZW50OicgKTtcblx0XHRcdGNvbnNvbGUuaW5mbyggY3VycmVudC5vcHRzLiRvcmlnICk7XG5cdFx0fVxuXHQqL1xuXG4gICAgb25Jbml0OiAkLm5vb3AsIC8vIFdoZW4gaW5zdGFuY2UgaGFzIGJlZW4gaW5pdGlhbGl6ZWRcblxuICAgIGJlZm9yZUxvYWQ6ICQubm9vcCwgLy8gQmVmb3JlIHRoZSBjb250ZW50IG9mIGEgc2xpZGUgaXMgYmVpbmcgbG9hZGVkXG4gICAgYWZ0ZXJMb2FkOiAkLm5vb3AsIC8vIFdoZW4gdGhlIGNvbnRlbnQgb2YgYSBzbGlkZSBpcyBkb25lIGxvYWRpbmdcblxuICAgIGJlZm9yZVNob3c6ICQubm9vcCwgLy8gQmVmb3JlIG9wZW4gYW5pbWF0aW9uIHN0YXJ0c1xuICAgIGFmdGVyU2hvdzogJC5ub29wLCAvLyBXaGVuIGNvbnRlbnQgaXMgZG9uZSBsb2FkaW5nIGFuZCBhbmltYXRpbmdcblxuICAgIGJlZm9yZUNsb3NlOiAkLm5vb3AsIC8vIEJlZm9yZSB0aGUgaW5zdGFuY2UgYXR0ZW1wdHMgdG8gY2xvc2UuIFJldHVybiBmYWxzZSB0byBjYW5jZWwgdGhlIGNsb3NlLlxuICAgIGFmdGVyQ2xvc2U6ICQubm9vcCwgLy8gQWZ0ZXIgaW5zdGFuY2UgaGFzIGJlZW4gY2xvc2VkXG5cbiAgICBvbkFjdGl2YXRlOiAkLm5vb3AsIC8vIFdoZW4gaW5zdGFuY2UgaXMgYnJvdWdodCB0byBmcm9udFxuICAgIG9uRGVhY3RpdmF0ZTogJC5ub29wLCAvLyBXaGVuIG90aGVyIGluc3RhbmNlIGhhcyBiZWVuIGFjdGl2YXRlZFxuXG4gICAgLy8gSW50ZXJhY3Rpb25cbiAgICAvLyA9PT09PT09PT09PVxuXG4gICAgLy8gVXNlIG9wdGlvbnMgYmVsb3cgdG8gY3VzdG9taXplIHRha2VuIGFjdGlvbiB3aGVuIHVzZXIgY2xpY2tzIG9yIGRvdWJsZSBjbGlja3Mgb24gdGhlIGZhbmN5Qm94IGFyZWEsXG4gICAgLy8gZWFjaCBvcHRpb24gY2FuIGJlIHN0cmluZyBvciBtZXRob2QgdGhhdCByZXR1cm5zIHZhbHVlLlxuICAgIC8vXG4gICAgLy8gUG9zc2libGUgdmFsdWVzOlxuICAgIC8vICAgXCJjbG9zZVwiICAgICAgICAgICAtIGNsb3NlIGluc3RhbmNlXG4gICAgLy8gICBcIm5leHRcIiAgICAgICAgICAgIC0gbW92ZSB0byBuZXh0IGdhbGxlcnkgaXRlbVxuICAgIC8vICAgXCJuZXh0T3JDbG9zZVwiICAgICAtIG1vdmUgdG8gbmV4dCBnYWxsZXJ5IGl0ZW0gb3IgY2xvc2UgaWYgZ2FsbGVyeSBoYXMgb25seSBvbmUgaXRlbVxuICAgIC8vICAgXCJ0b2dnbGVDb250cm9sc1wiICAtIHNob3cvaGlkZSBjb250cm9sc1xuICAgIC8vICAgXCJ6b29tXCIgICAgICAgICAgICAtIHpvb20gaW1hZ2UgKGlmIGxvYWRlZClcbiAgICAvLyAgIGZhbHNlICAgICAgICAgICAgIC0gZG8gbm90aGluZ1xuXG4gICAgLy8gQ2xpY2tlZCBvbiB0aGUgY29udGVudFxuICAgIGNsaWNrQ29udGVudDogZnVuY3Rpb24oY3VycmVudCwgZXZlbnQpIHtcbiAgICAgIHJldHVybiBjdXJyZW50LnR5cGUgPT09IFwiaW1hZ2VcIiA/IFwiem9vbVwiIDogZmFsc2U7XG4gICAgfSxcblxuICAgIC8vIENsaWNrZWQgb24gdGhlIHNsaWRlXG4gICAgY2xpY2tTbGlkZTogXCJjbG9zZVwiLFxuXG4gICAgLy8gQ2xpY2tlZCBvbiB0aGUgYmFja2dyb3VuZCAoYmFja2Ryb3ApIGVsZW1lbnQ7XG4gICAgLy8gaWYgeW91IGhhdmUgbm90IGNoYW5nZWQgdGhlIGxheW91dCwgdGhlbiBtb3N0IGxpa2VseSB5b3UgbmVlZCB0byB1c2UgYGNsaWNrU2xpZGVgIG9wdGlvblxuICAgIGNsaWNrT3V0c2lkZTogXCJjbG9zZVwiLFxuXG4gICAgLy8gU2FtZSBhcyBwcmV2aW91cyB0d28sIGJ1dCBmb3IgZG91YmxlIGNsaWNrXG4gICAgZGJsY2xpY2tDb250ZW50OiBmYWxzZSxcbiAgICBkYmxjbGlja1NsaWRlOiBmYWxzZSxcbiAgICBkYmxjbGlja091dHNpZGU6IGZhbHNlLFxuXG4gICAgLy8gQ3VzdG9tIG9wdGlvbnMgd2hlbiBtb2JpbGUgZGV2aWNlIGlzIGRldGVjdGVkXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBtb2JpbGU6IHtcbiAgICAgIGlkbGVUaW1lOiBmYWxzZSxcbiAgICAgIGNsaWNrQ29udGVudDogZnVuY3Rpb24oY3VycmVudCwgZXZlbnQpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnQudHlwZSA9PT0gXCJpbWFnZVwiID8gXCJ0b2dnbGVDb250cm9sc1wiIDogZmFsc2U7XG4gICAgICB9LFxuICAgICAgY2xpY2tTbGlkZTogZnVuY3Rpb24oY3VycmVudCwgZXZlbnQpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnQudHlwZSA9PT0gXCJpbWFnZVwiID8gXCJ0b2dnbGVDb250cm9sc1wiIDogXCJjbG9zZVwiO1xuICAgICAgfSxcbiAgICAgIGRibGNsaWNrQ29udGVudDogZnVuY3Rpb24oY3VycmVudCwgZXZlbnQpIHtcbiAgICAgICAgcmV0dXJuIGN1cnJlbnQudHlwZSA9PT0gXCJpbWFnZVwiID8gXCJ6b29tXCIgOiBmYWxzZTtcbiAgICAgIH0sXG4gICAgICBkYmxjbGlja1NsaWRlOiBmdW5jdGlvbihjdXJyZW50LCBldmVudCkge1xuICAgICAgICByZXR1cm4gY3VycmVudC50eXBlID09PSBcImltYWdlXCIgPyBcInpvb21cIiA6IGZhbHNlO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyBJbnRlcm5hdGlvbmFsaXphdGlvblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09XG5cbiAgICBsYW5nOiBcImVuXCIsXG4gICAgaTE4bjoge1xuICAgICAgZW46IHtcbiAgICAgICAgQ0xPU0U6IFwiQ2xvc2VcIixcbiAgICAgICAgTkVYVDogXCJOZXh0XCIsXG4gICAgICAgIFBSRVY6IFwiUHJldmlvdXNcIixcbiAgICAgICAgRVJST1I6IFwiVGhlIHJlcXVlc3RlZCBjb250ZW50IGNhbm5vdCBiZSBsb2FkZWQuIDxici8+IFBsZWFzZSB0cnkgYWdhaW4gbGF0ZXIuXCIsXG4gICAgICAgIFBMQVlfU1RBUlQ6IFwiU3RhcnQgc2xpZGVzaG93XCIsXG4gICAgICAgIFBMQVlfU1RPUDogXCJQYXVzZSBzbGlkZXNob3dcIixcbiAgICAgICAgRlVMTF9TQ1JFRU46IFwiRnVsbCBzY3JlZW5cIixcbiAgICAgICAgVEhVTUJTOiBcIlRodW1ibmFpbHNcIixcbiAgICAgICAgRE9XTkxPQUQ6IFwiRG93bmxvYWRcIixcbiAgICAgICAgU0hBUkU6IFwiU2hhcmVcIixcbiAgICAgICAgWk9PTTogXCJab29tXCJcbiAgICAgIH0sXG4gICAgICBkZToge1xuICAgICAgICBDTE9TRTogXCJTY2hsaWVzc2VuXCIsXG4gICAgICAgIE5FWFQ6IFwiV2VpdGVyXCIsXG4gICAgICAgIFBSRVY6IFwiWnVyw7xja1wiLFxuICAgICAgICBFUlJPUjogXCJEaWUgYW5nZWZvcmRlcnRlbiBEYXRlbiBrb25udGVuIG5pY2h0IGdlbGFkZW4gd2VyZGVuLiA8YnIvPiBCaXR0ZSB2ZXJzdWNoZW4gU2llIGVzIHNww6R0ZXIgbm9jaG1hbC5cIixcbiAgICAgICAgUExBWV9TVEFSVDogXCJEaWFzY2hhdSBzdGFydGVuXCIsXG4gICAgICAgIFBMQVlfU1RPUDogXCJEaWFzY2hhdSBiZWVuZGVuXCIsXG4gICAgICAgIEZVTExfU0NSRUVOOiBcIlZvbGxiaWxkXCIsXG4gICAgICAgIFRIVU1CUzogXCJWb3JzY2hhdWJpbGRlclwiLFxuICAgICAgICBET1dOTE9BRDogXCJIZXJ1bnRlcmxhZGVuXCIsXG4gICAgICAgIFNIQVJFOiBcIlRlaWxlblwiLFxuICAgICAgICBaT09NOiBcIk1hw59zdGFiXCJcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gRmV3IHVzZWZ1bCB2YXJpYWJsZXMgYW5kIG1ldGhvZHNcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICB2YXIgJFcgPSAkKHdpbmRvdyk7XG4gIHZhciAkRCA9ICQoZG9jdW1lbnQpO1xuXG4gIHZhciBjYWxsZWQgPSAwO1xuXG4gIC8vIENoZWNrIGlmIGFuIG9iamVjdCBpcyBhIGpRdWVyeSBvYmplY3QgYW5kIG5vdCBhIG5hdGl2ZSBKYXZhU2NyaXB0IG9iamVjdFxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgdmFyIGlzUXVlcnkgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqICYmIG9iai5oYXNPd25Qcm9wZXJ0eSAmJiBvYmogaW5zdGFuY2VvZiAkO1xuICB9O1xuXG4gIC8vIEhhbmRsZSBtdWx0aXBsZSBicm93c2VycyBmb3IgXCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWVcIiBhbmQgXCJjYW5jZWxBbmltYXRpb25GcmFtZVwiXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgdmFyIHJlcXVlc3RBRnJhbWUgPSAoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICAgIHdpbmRvdy53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICAgIHdpbmRvdy5tb3pSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICAgIHdpbmRvdy5vUmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XG4gICAgICAvLyBpZiBhbGwgZWxzZSBmYWlscywgdXNlIHNldFRpbWVvdXRcbiAgICAgIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHJldHVybiB3aW5kb3cuc2V0VGltZW91dChjYWxsYmFjaywgMTAwMCAvIDYwKTtcbiAgICAgIH1cbiAgICApO1xuICB9KSgpO1xuXG4gIC8vIERldGVjdCB0aGUgc3VwcG9ydGVkIHRyYW5zaXRpb24tZW5kIGV2ZW50IHByb3BlcnR5IG5hbWVcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICB2YXIgdHJhbnNpdGlvbkVuZCA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZmFrZWVsZW1lbnRcIiksXG4gICAgICB0O1xuXG4gICAgdmFyIHRyYW5zaXRpb25zID0ge1xuICAgICAgdHJhbnNpdGlvbjogXCJ0cmFuc2l0aW9uZW5kXCIsXG4gICAgICBPVHJhbnNpdGlvbjogXCJvVHJhbnNpdGlvbkVuZFwiLFxuICAgICAgTW96VHJhbnNpdGlvbjogXCJ0cmFuc2l0aW9uZW5kXCIsXG4gICAgICBXZWJraXRUcmFuc2l0aW9uOiBcIndlYmtpdFRyYW5zaXRpb25FbmRcIlxuICAgIH07XG5cbiAgICBmb3IgKHQgaW4gdHJhbnNpdGlvbnMpIHtcbiAgICAgIGlmIChlbC5zdHlsZVt0XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiB0cmFuc2l0aW9uc1t0XTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gXCJ0cmFuc2l0aW9uZW5kXCI7XG4gIH0pKCk7XG5cbiAgLy8gRm9yY2UgcmVkcmF3IG9uIGFuIGVsZW1lbnQuXG4gIC8vIFRoaXMgaGVscHMgaW4gY2FzZXMgd2hlcmUgdGhlIGJyb3dzZXIgZG9lc24ndCByZWRyYXcgYW4gdXBkYXRlZCBlbGVtZW50IHByb3Blcmx5XG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIHZhciBmb3JjZVJlZHJhdyA9IGZ1bmN0aW9uKCRlbCkge1xuICAgIHJldHVybiAkZWwgJiYgJGVsLmxlbmd0aCAmJiAkZWxbMF0ub2Zmc2V0SGVpZ2h0O1xuICB9O1xuXG4gIC8vIEV4Y2x1ZGUgYXJyYXkgKGBidXR0b25zYCkgb3B0aW9ucyBmcm9tIGRlZXAgbWVyZ2luZ1xuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgdmFyIG1lcmdlT3B0cyA9IGZ1bmN0aW9uKG9wdHMxLCBvcHRzMikge1xuICAgIHZhciByZXogPSAkLmV4dGVuZCh0cnVlLCB7fSwgb3B0czEsIG9wdHMyKTtcblxuICAgICQuZWFjaChvcHRzMiwgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgaWYgKCQuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV6W2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXo7XG4gIH07XG5cbiAgLy8gQ2xhc3MgZGVmaW5pdGlvblxuICAvLyA9PT09PT09PT09PT09PT09XG5cbiAgdmFyIEZhbmN5Qm94ID0gZnVuY3Rpb24oY29udGVudCwgb3B0cywgaW5kZXgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBzZWxmLm9wdHMgPSBtZXJnZU9wdHMoe2luZGV4OiBpbmRleH0sICQuZmFuY3lib3guZGVmYXVsdHMpO1xuXG4gICAgaWYgKCQuaXNQbGFpbk9iamVjdChvcHRzKSkge1xuICAgICAgc2VsZi5vcHRzID0gbWVyZ2VPcHRzKHNlbGYub3B0cywgb3B0cyk7XG4gICAgfVxuXG4gICAgaWYgKCQuZmFuY3lib3guaXNNb2JpbGUpIHtcbiAgICAgIHNlbGYub3B0cyA9IG1lcmdlT3B0cyhzZWxmLm9wdHMsIHNlbGYub3B0cy5tb2JpbGUpO1xuICAgIH1cblxuICAgIHNlbGYuaWQgPSBzZWxmLm9wdHMuaWQgfHwgKytjYWxsZWQ7XG5cbiAgICBzZWxmLmN1cnJJbmRleCA9IHBhcnNlSW50KHNlbGYub3B0cy5pbmRleCwgMTApIHx8IDA7XG4gICAgc2VsZi5wcmV2SW5kZXggPSBudWxsO1xuXG4gICAgc2VsZi5wcmV2UG9zID0gbnVsbDtcbiAgICBzZWxmLmN1cnJQb3MgPSAwO1xuXG4gICAgc2VsZi5maXJzdFJ1biA9IHRydWU7XG5cbiAgICAvLyBBbGwgZ3JvdXAgaXRlbXNcbiAgICBzZWxmLmdyb3VwID0gW107XG5cbiAgICAvLyBFeGlzdGluZyBzbGlkZXMgKGZvciBjdXJyZW50LCBuZXh0IGFuZCBwcmV2aW91cyBnYWxsZXJ5IGl0ZW1zKVxuICAgIHNlbGYuc2xpZGVzID0ge307XG5cbiAgICAvLyBDcmVhdGUgZ3JvdXAgZWxlbWVudHNcbiAgICBzZWxmLmFkZENvbnRlbnQoY29udGVudCk7XG5cbiAgICBpZiAoIXNlbGYuZ3JvdXAubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gU2F2ZSBsYXN0IGFjdGl2ZSBlbGVtZW50XG4gICAgc2VsZi4kbGFzdEZvY3VzID0gJChkb2N1bWVudC5hY3RpdmVFbGVtZW50KS50cmlnZ2VyKFwiYmx1clwiKTtcblxuICAgIHNlbGYuaW5pdCgpO1xuICB9O1xuXG4gICQuZXh0ZW5kKEZhbmN5Qm94LnByb3RvdHlwZSwge1xuICAgIC8vIENyZWF0ZSBET00gc3RydWN0dXJlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT1cblxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBmaXJzdEl0ZW0gPSBzZWxmLmdyb3VwW3NlbGYuY3VyckluZGV4XSxcbiAgICAgICAgZmlyc3RJdGVtT3B0cyA9IGZpcnN0SXRlbS5vcHRzLFxuICAgICAgICBzY3JvbGxiYXJXaWR0aCA9ICQuZmFuY3lib3guc2Nyb2xsYmFyV2lkdGgsXG4gICAgICAgICRzY3JvbGxEaXYsXG4gICAgICAgICRjb250YWluZXIsXG4gICAgICAgIGJ1dHRvblN0cjtcblxuICAgICAgLy8gSGlkZSBzY3JvbGxiYXJzXG4gICAgICAvLyA9PT09PT09PT09PT09PT1cblxuICAgICAgaWYgKCEkLmZhbmN5Ym94LmdldEluc3RhbmNlKCkgJiYgZmlyc3RJdGVtT3B0cy5oaWRlU2Nyb2xsYmFyICE9PSBmYWxzZSkge1xuICAgICAgICAkKFwiYm9keVwiKS5hZGRDbGFzcyhcImZhbmN5Ym94LWFjdGl2ZVwiKTtcblxuICAgICAgICBpZiAoISQuZmFuY3lib3guaXNNb2JpbGUgJiYgZG9jdW1lbnQuYm9keS5zY3JvbGxIZWlnaHQgPiB3aW5kb3cuaW5uZXJIZWlnaHQpIHtcbiAgICAgICAgICBpZiAoc2Nyb2xsYmFyV2lkdGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgJHNjcm9sbERpdiA9ICQoJzxkaXYgc3R5bGU9XCJ3aWR0aDoxMDBweDtoZWlnaHQ6MTAwcHg7b3ZlcmZsb3c6c2Nyb2xsO1wiIC8+JykuYXBwZW5kVG8oXCJib2R5XCIpO1xuXG4gICAgICAgICAgICBzY3JvbGxiYXJXaWR0aCA9ICQuZmFuY3lib3guc2Nyb2xsYmFyV2lkdGggPSAkc2Nyb2xsRGl2WzBdLm9mZnNldFdpZHRoIC0gJHNjcm9sbERpdlswXS5jbGllbnRXaWR0aDtcblxuICAgICAgICAgICAgJHNjcm9sbERpdi5yZW1vdmUoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAkKFwiaGVhZFwiKS5hcHBlbmQoXG4gICAgICAgICAgICAnPHN0eWxlIGlkPVwiZmFuY3lib3gtc3R5bGUtbm9zY3JvbGxcIiB0eXBlPVwidGV4dC9jc3NcIj4uY29tcGVuc2F0ZS1mb3Itc2Nyb2xsYmFyIHsgbWFyZ2luLXJpZ2h0OiAnICtcbiAgICAgICAgICAgICAgc2Nyb2xsYmFyV2lkdGggK1xuICAgICAgICAgICAgICBcInB4OyB9PC9zdHlsZT5cIlxuICAgICAgICAgICk7XG5cbiAgICAgICAgICAkKFwiYm9keVwiKS5hZGRDbGFzcyhcImNvbXBlbnNhdGUtZm9yLXNjcm9sbGJhclwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBCdWlsZCBodG1sIG1hcmt1cCBhbmQgc2V0IHJlZmVyZW5jZXNcbiAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgICAvLyBCdWlsZCBodG1sIGNvZGUgZm9yIGJ1dHRvbnMgYW5kIGluc2VydCBpbnRvIG1haW4gdGVtcGxhdGVcbiAgICAgIGJ1dHRvblN0ciA9IFwiXCI7XG5cbiAgICAgICQuZWFjaChmaXJzdEl0ZW1PcHRzLmJ1dHRvbnMsIGZ1bmN0aW9uKGluZGV4LCB2YWx1ZSkge1xuICAgICAgICBidXR0b25TdHIgKz0gZmlyc3RJdGVtT3B0cy5idG5UcGxbdmFsdWVdIHx8IFwiXCI7XG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JlYXRlIG1hcmt1cCBmcm9tIGJhc2UgdGVtcGxhdGUsIGl0IHdpbGwgYmUgaW5pdGlhbGx5IGhpZGRlbiB0b1xuICAgICAgLy8gYXZvaWQgdW5uZWNlc3Nhcnkgd29yayBsaWtlIHBhaW50aW5nIHdoaWxlIGluaXRpYWxpemluZyBpcyBub3QgY29tcGxldGVcbiAgICAgICRjb250YWluZXIgPSAkKFxuICAgICAgICBzZWxmLnRyYW5zbGF0ZShcbiAgICAgICAgICBzZWxmLFxuICAgICAgICAgIGZpcnN0SXRlbU9wdHMuYmFzZVRwbFxuICAgICAgICAgICAgLnJlcGxhY2UoXCJ7e2J1dHRvbnN9fVwiLCBidXR0b25TdHIpXG4gICAgICAgICAgICAucmVwbGFjZShcInt7YXJyb3dzfX1cIiwgZmlyc3RJdGVtT3B0cy5idG5UcGwuYXJyb3dMZWZ0ICsgZmlyc3RJdGVtT3B0cy5idG5UcGwuYXJyb3dSaWdodClcbiAgICAgICAgKVxuICAgICAgKVxuICAgICAgICAuYXR0cihcImlkXCIsIFwiZmFuY3lib3gtY29udGFpbmVyLVwiICsgc2VsZi5pZClcbiAgICAgICAgLmFkZENsYXNzKFwiZmFuY3lib3gtaXMtaGlkZGVuXCIpXG4gICAgICAgIC5hZGRDbGFzcyhmaXJzdEl0ZW1PcHRzLmJhc2VDbGFzcylcbiAgICAgICAgLmRhdGEoXCJGYW5jeUJveFwiLCBzZWxmKVxuICAgICAgICAuYXBwZW5kVG8oZmlyc3RJdGVtT3B0cy5wYXJlbnRFbCk7XG5cbiAgICAgIC8vIENyZWF0ZSBvYmplY3QgaG9sZGluZyByZWZlcmVuY2VzIHRvIGpRdWVyeSB3cmFwcGVkIG5vZGVzXG4gICAgICBzZWxmLiRyZWZzID0ge1xuICAgICAgICBjb250YWluZXI6ICRjb250YWluZXJcbiAgICAgIH07XG5cbiAgICAgIFtcImJnXCIsIFwiaW5uZXJcIiwgXCJpbmZvYmFyXCIsIFwidG9vbGJhclwiLCBcInN0YWdlXCIsIFwiY2FwdGlvblwiLCBcIm5hdmlnYXRpb25cIl0uZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHNlbGYuJHJlZnNbaXRlbV0gPSAkY29udGFpbmVyLmZpbmQoXCIuZmFuY3lib3gtXCIgKyBpdGVtKTtcbiAgICAgIH0pO1xuXG4gICAgICBzZWxmLnRyaWdnZXIoXCJvbkluaXRcIik7XG5cbiAgICAgIC8vIEVuYWJsZSBldmVudHMsIGRlYWN0aXZlIHByZXZpb3VzIGluc3RhbmNlc1xuICAgICAgc2VsZi5hY3RpdmF0ZSgpO1xuXG4gICAgICAvLyBCdWlsZCBzbGlkZXMsIGxvYWQgYW5kIHJldmVhbCBjb250ZW50XG4gICAgICBzZWxmLmp1bXBUbyhzZWxmLmN1cnJJbmRleCk7XG4gICAgfSxcblxuICAgIC8vIFNpbXBsZSBpMThuIHN1cHBvcnQgLSByZXBsYWNlcyBvYmplY3Qga2V5cyBmb3VuZCBpbiB0ZW1wbGF0ZVxuICAgIC8vIHdpdGggY29ycmVzcG9uZGluZyB2YWx1ZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRyYW5zbGF0ZTogZnVuY3Rpb24ob2JqLCBzdHIpIHtcbiAgICAgIHZhciBhcnIgPSBvYmoub3B0cy5pMThuW29iai5vcHRzLmxhbmddO1xuXG4gICAgICByZXR1cm4gc3RyLnJlcGxhY2UoL1xce1xceyhcXHcrKVxcfVxcfS9nLCBmdW5jdGlvbihtYXRjaCwgbikge1xuICAgICAgICB2YXIgdmFsdWUgPSBhcnJbbl07XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4gbWF0Y2g7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgLy8gUG9wdWxhdGUgY3VycmVudCBncm91cCB3aXRoIGZyZXNoIGNvbnRlbnRcbiAgICAvLyBDaGVjayBpZiBlYWNoIG9iamVjdCBoYXMgdmFsaWQgdHlwZSBhbmQgY29udGVudFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBhZGRDb250ZW50OiBmdW5jdGlvbihjb250ZW50KSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIGl0ZW1zID0gJC5tYWtlQXJyYXkoY29udGVudCksXG4gICAgICAgIHRodW1icztcblxuICAgICAgJC5lYWNoKGl0ZW1zLCBmdW5jdGlvbihpLCBpdGVtKSB7XG4gICAgICAgIHZhciBvYmogPSB7fSxcbiAgICAgICAgICBvcHRzID0ge30sXG4gICAgICAgICAgJGl0ZW0sXG4gICAgICAgICAgdHlwZSxcbiAgICAgICAgICBmb3VuZCxcbiAgICAgICAgICBzcmMsXG4gICAgICAgICAgc3JjUGFydHM7XG5cbiAgICAgICAgLy8gU3RlcCAxIC0gTWFrZSBzdXJlIHdlIGhhdmUgYW4gb2JqZWN0XG4gICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgICAgIGlmICgkLmlzUGxhaW5PYmplY3QoaXRlbSkpIHtcbiAgICAgICAgICAvLyBXZSBwcm9iYWJseSBoYXZlIG1hbnVhbCB1c2FnZSBoZXJlLCBzb21ldGhpbmcgbGlrZVxuICAgICAgICAgIC8vICQuZmFuY3lib3gub3BlbiggWyB7IHNyYyA6IFwiaW1hZ2UuanBnXCIsIHR5cGUgOiBcImltYWdlXCIgfSBdIClcblxuICAgICAgICAgIG9iaiA9IGl0ZW07XG4gICAgICAgICAgb3B0cyA9IGl0ZW0ub3B0cyB8fCBpdGVtO1xuICAgICAgICB9IGVsc2UgaWYgKCQudHlwZShpdGVtKSA9PT0gXCJvYmplY3RcIiAmJiAkKGl0ZW0pLmxlbmd0aCkge1xuICAgICAgICAgIC8vIEhlcmUgd2UgcHJvYmFibHkgaGF2ZSBqUXVlcnkgY29sbGVjdGlvbiByZXR1cm5lZCBieSBzb21lIHNlbGVjdG9yXG4gICAgICAgICAgJGl0ZW0gPSAkKGl0ZW0pO1xuXG4gICAgICAgICAgLy8gU3VwcG9ydCBhdHRyaWJ1dGVzIGxpa2UgYGRhdGEtb3B0aW9ucz0ne1widG91Y2hcIiA6IGZhbHNlfSdgIGFuZCBgZGF0YS10b3VjaD0nZmFsc2UnYFxuICAgICAgICAgIG9wdHMgPSAkaXRlbS5kYXRhKCkgfHwge307XG4gICAgICAgICAgb3B0cyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBvcHRzLCBvcHRzLm9wdGlvbnMpO1xuXG4gICAgICAgICAgLy8gSGVyZSB3ZSBzdG9yZSBjbGlja2VkIGVsZW1lbnRcbiAgICAgICAgICBvcHRzLiRvcmlnID0gJGl0ZW07XG5cbiAgICAgICAgICBvYmouc3JjID0gc2VsZi5vcHRzLnNyYyB8fCBvcHRzLnNyYyB8fCAkaXRlbS5hdHRyKFwiaHJlZlwiKTtcblxuICAgICAgICAgIC8vIEFzc3VtZSB0aGF0IHNpbXBsZSBzeW50YXggaXMgdXNlZCwgZm9yIGV4YW1wbGU6XG4gICAgICAgICAgLy8gICBgJC5mYW5jeWJveC5vcGVuKCAkKFwiI3Rlc3RcIiksIHt9ICk7YFxuICAgICAgICAgIGlmICghb2JqLnR5cGUgJiYgIW9iai5zcmMpIHtcbiAgICAgICAgICAgIG9iai50eXBlID0gXCJpbmxpbmVcIjtcbiAgICAgICAgICAgIG9iai5zcmMgPSBpdGVtO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBBc3N1bWUgd2UgaGF2ZSBhIHNpbXBsZSBodG1sIGNvZGUsIGZvciBleGFtcGxlOlxuICAgICAgICAgIC8vICAgJC5mYW5jeWJveC5vcGVuKCAnPGRpdj48aDE+SGkhPC9oMT48L2Rpdj4nICk7XG4gICAgICAgICAgb2JqID0ge1xuICAgICAgICAgICAgdHlwZTogXCJodG1sXCIsXG4gICAgICAgICAgICBzcmM6IGl0ZW0gKyBcIlwiXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVhY2ggZ2FsbGVyeSBvYmplY3QgaGFzIGZ1bGwgY29sbGVjdGlvbiBvZiBvcHRpb25zXG4gICAgICAgIG9iai5vcHRzID0gJC5leHRlbmQodHJ1ZSwge30sIHNlbGYub3B0cywgb3B0cyk7XG5cbiAgICAgICAgLy8gRG8gbm90IG1lcmdlIGJ1dHRvbnMgYXJyYXlcbiAgICAgICAgaWYgKCQuaXNBcnJheShvcHRzLmJ1dHRvbnMpKSB7XG4gICAgICAgICAgb2JqLm9wdHMuYnV0dG9ucyA9IG9wdHMuYnV0dG9ucztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgMiAtIE1ha2Ugc3VyZSB3ZSBoYXZlIGNvbnRlbnQgdHlwZSwgaWYgbm90IC0gdHJ5IHRvIGd1ZXNzXG4gICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAgICAgdHlwZSA9IG9iai50eXBlIHx8IG9iai5vcHRzLnR5cGU7XG4gICAgICAgIHNyYyA9IG9iai5zcmMgfHwgXCJcIjtcblxuICAgICAgICBpZiAoIXR5cGUgJiYgc3JjKSB7XG4gICAgICAgICAgaWYgKChmb3VuZCA9IHNyYy5tYXRjaCgvXFwuKG1wNHxtb3Z8b2d2KSgoXFw/fCMpLiopPyQvaSkpKSB7XG4gICAgICAgICAgICB0eXBlID0gXCJ2aWRlb1wiO1xuXG4gICAgICAgICAgICBpZiAoIW9iai5vcHRzLnZpZGVvRm9ybWF0KSB7XG4gICAgICAgICAgICAgIG9iai5vcHRzLnZpZGVvRm9ybWF0ID0gXCJ2aWRlby9cIiArIChmb3VuZFsxXSA9PT0gXCJvZ3ZcIiA/IFwib2dnXCIgOiBmb3VuZFsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChzcmMubWF0Y2goLyheZGF0YTppbWFnZVxcL1thLXowLTkrXFwvPV0qLCl8KFxcLihqcChlfGd8ZWcpfGdpZnxwbmd8Ym1wfHdlYnB8c3ZnfGljbykoKFxcP3wjKS4qKT8kKS9pKSkge1xuICAgICAgICAgICAgdHlwZSA9IFwiaW1hZ2VcIjtcbiAgICAgICAgICB9IGVsc2UgaWYgKHNyYy5tYXRjaCgvXFwuKHBkZikoKFxcP3wjKS4qKT8kL2kpKSB7XG4gICAgICAgICAgICB0eXBlID0gXCJpZnJhbWVcIjtcbiAgICAgICAgICB9IGVsc2UgaWYgKHNyYy5jaGFyQXQoMCkgPT09IFwiI1wiKSB7XG4gICAgICAgICAgICB0eXBlID0gXCJpbmxpbmVcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgIG9iai50eXBlID0gdHlwZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWxmLnRyaWdnZXIoXCJvYmplY3ROZWVkc1R5cGVcIiwgb2JqKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghb2JqLmNvbnRlbnRUeXBlKSB7XG4gICAgICAgICAgb2JqLmNvbnRlbnRUeXBlID0gJC5pbkFycmF5KG9iai50eXBlLCBbXCJodG1sXCIsIFwiaW5saW5lXCIsIFwiYWpheFwiXSkgPiAtMSA/IFwiaHRtbFwiIDogb2JqLnR5cGU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIDMgLSBTb21lIGFkanVzdG1lbnRzXG4gICAgICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgICAgICBvYmouaW5kZXggPSBzZWxmLmdyb3VwLmxlbmd0aDtcblxuICAgICAgICBpZiAob2JqLm9wdHMuc21hbGxCdG4gPT0gXCJhdXRvXCIpIHtcbiAgICAgICAgICBvYmoub3B0cy5zbWFsbEJ0biA9ICQuaW5BcnJheShvYmoudHlwZSwgW1wiaHRtbFwiLCBcImlubGluZVwiLCBcImFqYXhcIl0pID4gLTE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob2JqLm9wdHMudG9vbGJhciA9PT0gXCJhdXRvXCIpIHtcbiAgICAgICAgICBvYmoub3B0cy50b29sYmFyID0gIW9iai5vcHRzLnNtYWxsQnRuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmluZCB0aHVtYm5haWwgaW1hZ2VcbiAgICAgICAgaWYgKG9iai5vcHRzLiR0cmlnZ2VyICYmIG9iai5pbmRleCA9PT0gc2VsZi5vcHRzLmluZGV4KSB7XG4gICAgICAgICAgb2JqLm9wdHMuJHRodW1iID0gb2JqLm9wdHMuJHRyaWdnZXIuZmluZChcImltZzpmaXJzdFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgoIW9iai5vcHRzLiR0aHVtYiB8fCAhb2JqLm9wdHMuJHRodW1iLmxlbmd0aCkgJiYgb2JqLm9wdHMuJG9yaWcpIHtcbiAgICAgICAgICBvYmoub3B0cy4kdGh1bWIgPSBvYmoub3B0cy4kb3JpZy5maW5kKFwiaW1nOmZpcnN0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gXCJjYXB0aW9uXCIgaXMgYSBcInNwZWNpYWxcIiBvcHRpb24sIGl0IGNhbiBiZSB1c2VkIHRvIGN1c3RvbWl6ZSBjYXB0aW9uIHBlciBnYWxsZXJ5IGl0ZW0gLi5cbiAgICAgICAgaWYgKCQudHlwZShvYmoub3B0cy5jYXB0aW9uKSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgb2JqLm9wdHMuY2FwdGlvbiA9IG9iai5vcHRzLmNhcHRpb24uYXBwbHkoaXRlbSwgW3NlbGYsIG9ial0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCQudHlwZShzZWxmLm9wdHMuY2FwdGlvbikgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIG9iai5vcHRzLmNhcHRpb24gPSBzZWxmLm9wdHMuY2FwdGlvbi5hcHBseShpdGVtLCBbc2VsZiwgb2JqXSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBNYWtlIHN1cmUgd2UgaGF2ZSBjYXB0aW9uIGFzIGEgc3RyaW5nIG9yIGpRdWVyeSBvYmplY3RcbiAgICAgICAgaWYgKCEob2JqLm9wdHMuY2FwdGlvbiBpbnN0YW5jZW9mICQpKSB7XG4gICAgICAgICAgb2JqLm9wdHMuY2FwdGlvbiA9IG9iai5vcHRzLmNhcHRpb24gPT09IHVuZGVmaW5lZCA/IFwiXCIgOiBvYmoub3B0cy5jYXB0aW9uICsgXCJcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIGlmIHVybCBjb250YWlucyBcImZpbHRlclwiIHVzZWQgdG8gZmlsdGVyIHRoZSBjb250ZW50XG4gICAgICAgIC8vIEV4YW1wbGU6IFwiYWpheC5odG1sICNzb21ldGhpbmdcIlxuICAgICAgICBpZiAob2JqLnR5cGUgPT09IFwiYWpheFwiKSB7XG4gICAgICAgICAgc3JjUGFydHMgPSBzcmMuc3BsaXQoL1xccysvLCAyKTtcblxuICAgICAgICAgIGlmIChzcmNQYXJ0cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBvYmouc3JjID0gc3JjUGFydHMuc2hpZnQoKTtcblxuICAgICAgICAgICAgb2JqLm9wdHMuZmlsdGVyID0gc3JjUGFydHMuc2hpZnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIaWRlIGFsbCBidXR0b25zIGFuZCBkaXNhYmxlIGludGVyYWN0aXZpdHkgZm9yIG1vZGFsIGl0ZW1zXG4gICAgICAgIGlmIChvYmoub3B0cy5tb2RhbCkge1xuICAgICAgICAgIG9iai5vcHRzID0gJC5leHRlbmQodHJ1ZSwgb2JqLm9wdHMsIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBidXR0b25zXG4gICAgICAgICAgICBpbmZvYmFyOiAwLFxuICAgICAgICAgICAgdG9vbGJhcjogMCxcblxuICAgICAgICAgICAgc21hbGxCdG46IDAsXG5cbiAgICAgICAgICAgIC8vIERpc2FibGUga2V5Ym9hcmQgbmF2aWdhdGlvblxuICAgICAgICAgICAga2V5Ym9hcmQ6IDAsXG5cbiAgICAgICAgICAgIC8vIERpc2FibGUgc29tZSBtb2R1bGVzXG4gICAgICAgICAgICBzbGlkZVNob3c6IDAsXG4gICAgICAgICAgICBmdWxsU2NyZWVuOiAwLFxuICAgICAgICAgICAgdGh1bWJzOiAwLFxuICAgICAgICAgICAgdG91Y2g6IDAsXG5cbiAgICAgICAgICAgIC8vIERpc2FibGUgY2xpY2sgZXZlbnQgaGFuZGxlcnNcbiAgICAgICAgICAgIGNsaWNrQ29udGVudDogZmFsc2UsXG4gICAgICAgICAgICBjbGlja1NsaWRlOiBmYWxzZSxcbiAgICAgICAgICAgIGNsaWNrT3V0c2lkZTogZmFsc2UsXG4gICAgICAgICAgICBkYmxjbGlja0NvbnRlbnQ6IGZhbHNlLFxuICAgICAgICAgICAgZGJsY2xpY2tTbGlkZTogZmFsc2UsXG4gICAgICAgICAgICBkYmxjbGlja091dHNpZGU6IGZhbHNlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIDQgLSBBZGQgcHJvY2Vzc2VkIG9iamVjdCB0byBncm91cFxuICAgICAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgICAgIHNlbGYuZ3JvdXAucHVzaChvYmopO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFVwZGF0ZSBjb250cm9scyBpZiBnYWxsZXJ5IGlzIGFscmVhZHkgb3BlbmVkXG4gICAgICBpZiAoT2JqZWN0LmtleXMoc2VsZi5zbGlkZXMpLmxlbmd0aCkge1xuICAgICAgICBzZWxmLnVwZGF0ZUNvbnRyb2xzKCk7XG5cbiAgICAgICAgLy8gVXBkYXRlIHRodW1ibmFpbHMsIGlmIG5lZWRlZFxuICAgICAgICB0aHVtYnMgPSBzZWxmLlRodW1icztcblxuICAgICAgICBpZiAodGh1bWJzICYmIHRodW1icy5pc0FjdGl2ZSkge1xuICAgICAgICAgIHRodW1icy5jcmVhdGUoKTtcblxuICAgICAgICAgIHRodW1icy5mb2N1cygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIEF0dGFjaCBhbiBldmVudCBoYW5kbGVyIGZ1bmN0aW9ucyBmb3I6XG4gICAgLy8gICAtIG5hdmlnYXRpb24gYnV0dG9uc1xuICAgIC8vICAgLSBicm93c2VyIHNjcm9sbGluZywgcmVzaXppbmc7XG4gICAgLy8gICAtIGZvY3VzaW5nXG4gICAgLy8gICAtIGtleWJvYXJkXG4gICAgLy8gICAtIGRldGVjdCBpZGxlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGFkZEV2ZW50czogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgIHNlbGYucmVtb3ZlRXZlbnRzKCk7XG5cbiAgICAgIC8vIE1ha2UgbmF2aWdhdGlvbiBlbGVtZW50cyBjbGlja2FibGVcbiAgICAgIHNlbGYuJHJlZnMuY29udGFpbmVyXG4gICAgICAgIC5vbihcImNsaWNrLmZiLWNsb3NlXCIsIFwiW2RhdGEtZmFuY3lib3gtY2xvc2VdXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgIHNlbGYuY2xvc2UoZSk7XG4gICAgICAgIH0pXG4gICAgICAgIC5vbihcInRvdWNoc3RhcnQuZmItcHJldiBjbGljay5mYi1wcmV2XCIsIFwiW2RhdGEtZmFuY3lib3gtcHJldl1cIiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgc2VsZi5wcmV2aW91cygpO1xuICAgICAgICB9KVxuICAgICAgICAub24oXCJ0b3VjaHN0YXJ0LmZiLW5leHQgY2xpY2suZmItbmV4dFwiLCBcIltkYXRhLWZhbmN5Ym94LW5leHRdXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgIHNlbGYubmV4dCgpO1xuICAgICAgICB9KVxuICAgICAgICAub24oXCJjbGljay5mYlwiLCBcIltkYXRhLWZhbmN5Ym94LXpvb21dXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAvLyBDbGljayBoYW5kbGVyIGZvciB6b29tIGJ1dHRvblxuICAgICAgICAgIHNlbGZbc2VsZi5pc1NjYWxlZERvd24oKSA/IFwic2NhbGVUb0FjdHVhbFwiIDogXCJzY2FsZVRvRml0XCJdKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAvLyBIYW5kbGUgcGFnZSBzY3JvbGxpbmcgYW5kIGJyb3dzZXIgcmVzaXppbmdcbiAgICAgICRXLm9uKFwib3JpZW50YXRpb25jaGFuZ2UuZmIgcmVzaXplLmZiXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUgJiYgZS5vcmlnaW5hbEV2ZW50ICYmIGUub3JpZ2luYWxFdmVudC50eXBlID09PSBcInJlc2l6ZVwiKSB7XG4gICAgICAgICAgcmVxdWVzdEFGcmFtZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNlbGYudXBkYXRlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VsZi4kcmVmcy5zdGFnZS5oaWRlKCk7XG5cbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi4kcmVmcy5zdGFnZS5zaG93KCk7XG5cbiAgICAgICAgICAgIHNlbGYudXBkYXRlKCk7XG4gICAgICAgICAgfSwgJC5mYW5jeWJveC5pc01vYmlsZSA/IDYwMCA6IDI1MCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBUcmFwIGtleWJvYXJkIGZvY3VzIGluc2lkZSBvZiB0aGUgbW9kYWwsIHNvIHRoZSB1c2VyIGRvZXMgbm90IGFjY2lkZW50YWxseSB0YWIgb3V0c2lkZSBvZiB0aGUgbW9kYWxcbiAgICAgIC8vIChhLmsuYS4gXCJlc2NhcGluZyB0aGUgbW9kYWxcIilcbiAgICAgICRELm9uKFwiZm9jdXNpbi5mYlwiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIHZhciBpbnN0YW5jZSA9ICQuZmFuY3lib3ggPyAkLmZhbmN5Ym94LmdldEluc3RhbmNlKCkgOiBudWxsO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICBpbnN0YW5jZS5pc0Nsb3NpbmcgfHxcbiAgICAgICAgICAhaW5zdGFuY2UuY3VycmVudCB8fFxuICAgICAgICAgICFpbnN0YW5jZS5jdXJyZW50Lm9wdHMudHJhcEZvY3VzIHx8XG4gICAgICAgICAgJChlLnRhcmdldCkuaGFzQ2xhc3MoXCJmYW5jeWJveC1jb250YWluZXJcIikgfHxcbiAgICAgICAgICAkKGUudGFyZ2V0KS5pcyhkb2N1bWVudClcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluc3RhbmNlICYmICQoZS50YXJnZXQpLmNzcyhcInBvc2l0aW9uXCIpICE9PSBcImZpeGVkXCIgJiYgIWluc3RhbmNlLiRyZWZzLmNvbnRhaW5lci5oYXMoZS50YXJnZXQpLmxlbmd0aCkge1xuICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAgICAgICBpbnN0YW5jZS5mb2N1cygpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gRW5hYmxlIGtleWJvYXJkIG5hdmlnYXRpb25cbiAgICAgICRELm9uKFwia2V5ZG93bi5mYlwiLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gc2VsZi5jdXJyZW50LFxuICAgICAgICAgIGtleWNvZGUgPSBlLmtleUNvZGUgfHwgZS53aGljaDtcblxuICAgICAgICBpZiAoIWN1cnJlbnQgfHwgIWN1cnJlbnQub3B0cy5rZXlib2FyZCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlLmN0cmxLZXkgfHwgZS5hbHRLZXkgfHwgZS5zaGlmdEtleSB8fCAkKGUudGFyZ2V0KS5pcyhcImlucHV0XCIpIHx8ICQoZS50YXJnZXQpLmlzKFwidGV4dGFyZWFcIikpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCYWNrc3BhY2UgYW5kIEVzYyBrZXlzXG4gICAgICAgIGlmIChrZXljb2RlID09PSA4IHx8IGtleWNvZGUgPT09IDI3KSB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgc2VsZi5jbG9zZShlKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIExlZnQgYXJyb3cgYW5kIFVwIGFycm93XG4gICAgICAgIGlmIChrZXljb2RlID09PSAzNyB8fCBrZXljb2RlID09PSAzOCkge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgIHNlbGYucHJldmlvdXMoKTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJpZ2ggYXJyb3cgYW5kIERvd24gYXJyb3dcbiAgICAgICAgaWYgKGtleWNvZGUgPT09IDM5IHx8IGtleWNvZGUgPT09IDQwKSB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgc2VsZi5uZXh0KCk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBzZWxmLnRyaWdnZXIoXCJhZnRlcktleWRvd25cIiwgZSwga2V5Y29kZSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gSGlkZSBjb250cm9scyBhZnRlciBzb21lIGluYWN0aXZpdHkgcGVyaW9kXG4gICAgICBpZiAoc2VsZi5ncm91cFtzZWxmLmN1cnJJbmRleF0ub3B0cy5pZGxlVGltZSkge1xuICAgICAgICBzZWxmLmlkbGVTZWNvbmRzQ291bnRlciA9IDA7XG5cbiAgICAgICAgJEQub24oXG4gICAgICAgICAgXCJtb3VzZW1vdmUuZmItaWRsZSBtb3VzZWxlYXZlLmZiLWlkbGUgbW91c2Vkb3duLmZiLWlkbGUgdG91Y2hzdGFydC5mYi1pZGxlIHRvdWNobW92ZS5mYi1pZGxlIHNjcm9sbC5mYi1pZGxlIGtleWRvd24uZmItaWRsZVwiLFxuICAgICAgICAgIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgIHNlbGYuaWRsZVNlY29uZHNDb3VudGVyID0gMDtcblxuICAgICAgICAgICAgaWYgKHNlbGYuaXNJZGxlKSB7XG4gICAgICAgICAgICAgIHNlbGYuc2hvd0NvbnRyb2xzKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlbGYuaXNJZGxlID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHNlbGYuaWRsZUludGVydmFsID0gd2luZG93LnNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHNlbGYuaWRsZVNlY29uZHNDb3VudGVyKys7XG5cbiAgICAgICAgICBpZiAoc2VsZi5pZGxlU2Vjb25kc0NvdW50ZXIgPj0gc2VsZi5ncm91cFtzZWxmLmN1cnJJbmRleF0ub3B0cy5pZGxlVGltZSAmJiAhc2VsZi5pc0RyYWdnaW5nKSB7XG4gICAgICAgICAgICBzZWxmLmlzSWRsZSA9IHRydWU7XG4gICAgICAgICAgICBzZWxmLmlkbGVTZWNvbmRzQ291bnRlciA9IDA7XG5cbiAgICAgICAgICAgIHNlbGYuaGlkZUNvbnRyb2xzKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCAxMDAwKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gUmVtb3ZlIGV2ZW50cyBhZGRlZCBieSB0aGUgY29yZVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHJlbW92ZUV2ZW50czogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICRXLm9mZihcIm9yaWVudGF0aW9uY2hhbmdlLmZiIHJlc2l6ZS5mYlwiKTtcbiAgICAgICRELm9mZihcImZvY3VzaW4uZmIga2V5ZG93bi5mYiAuZmItaWRsZVwiKTtcblxuICAgICAgdGhpcy4kcmVmcy5jb250YWluZXIub2ZmKFwiLmZiLWNsb3NlIC5mYi1wcmV2IC5mYi1uZXh0XCIpO1xuXG4gICAgICBpZiAoc2VsZi5pZGxlSW50ZXJ2YWwpIHtcbiAgICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwoc2VsZi5pZGxlSW50ZXJ2YWwpO1xuXG4gICAgICAgIHNlbGYuaWRsZUludGVydmFsID0gbnVsbDtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gQ2hhbmdlIHRvIHByZXZpb3VzIGdhbGxlcnkgaXRlbVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHByZXZpb3VzOiBmdW5jdGlvbihkdXJhdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMuanVtcFRvKHRoaXMuY3VyclBvcyAtIDEsIGR1cmF0aW9uKTtcbiAgICB9LFxuXG4gICAgLy8gQ2hhbmdlIHRvIG5leHQgZ2FsbGVyeSBpdGVtXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBuZXh0OiBmdW5jdGlvbihkdXJhdGlvbikge1xuICAgICAgcmV0dXJuIHRoaXMuanVtcFRvKHRoaXMuY3VyclBvcyArIDEsIGR1cmF0aW9uKTtcbiAgICB9LFxuXG4gICAgLy8gU3dpdGNoIHRvIHNlbGVjdGVkIGdhbGxlcnkgaXRlbVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGp1bXBUbzogZnVuY3Rpb24ocG9zLCBkdXJhdGlvbikge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBncm91cExlbiA9IHNlbGYuZ3JvdXAubGVuZ3RoLFxuICAgICAgICBmaXJzdFJ1bixcbiAgICAgICAgbG9vcCxcbiAgICAgICAgY3VycmVudCxcbiAgICAgICAgcHJldmlvdXMsXG4gICAgICAgIGNhbnZhc1dpZHRoLFxuICAgICAgICBjdXJyZW50UG9zLFxuICAgICAgICB0cmFuc2l0aW9uUHJvcHM7XG5cbiAgICAgIGlmIChzZWxmLmlzRHJhZ2dpbmcgfHwgc2VsZi5pc0Nsb3NpbmcgfHwgKHNlbGYuaXNBbmltYXRpbmcgJiYgc2VsZi5maXJzdFJ1bikpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBwb3MgPSBwYXJzZUludChwb3MsIDEwKTtcblxuICAgICAgLy8gU2hvdWxkIGxvb3A/XG4gICAgICBsb29wID0gc2VsZi5jdXJyZW50ID8gc2VsZi5jdXJyZW50Lm9wdHMubG9vcCA6IHNlbGYub3B0cy5sb29wO1xuXG4gICAgICBpZiAoIWxvb3AgJiYgKHBvcyA8IDAgfHwgcG9zID49IGdyb3VwTGVuKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGZpcnN0UnVuID0gc2VsZi5maXJzdFJ1biA9ICFPYmplY3Qua2V5cyhzZWxmLnNsaWRlcykubGVuZ3RoO1xuXG4gICAgICBpZiAoZ3JvdXBMZW4gPCAyICYmICFmaXJzdFJ1biAmJiAhIXNlbGYuaXNEcmFnZ2luZykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHByZXZpb3VzID0gc2VsZi5jdXJyZW50O1xuXG4gICAgICBzZWxmLnByZXZJbmRleCA9IHNlbGYuY3VyckluZGV4O1xuICAgICAgc2VsZi5wcmV2UG9zID0gc2VsZi5jdXJyUG9zO1xuXG4gICAgICAvLyBDcmVhdGUgc2xpZGVzXG4gICAgICBjdXJyZW50ID0gc2VsZi5jcmVhdGVTbGlkZShwb3MpO1xuXG4gICAgICBpZiAoZ3JvdXBMZW4gPiAxKSB7XG4gICAgICAgIGlmIChsb29wIHx8IGN1cnJlbnQuaW5kZXggPiAwKSB7XG4gICAgICAgICAgc2VsZi5jcmVhdGVTbGlkZShwb3MgLSAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsb29wIHx8IGN1cnJlbnQuaW5kZXggPCBncm91cExlbiAtIDEpIHtcbiAgICAgICAgICBzZWxmLmNyZWF0ZVNsaWRlKHBvcyArIDEpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHNlbGYuY3VycmVudCA9IGN1cnJlbnQ7XG4gICAgICBzZWxmLmN1cnJJbmRleCA9IGN1cnJlbnQuaW5kZXg7XG4gICAgICBzZWxmLmN1cnJQb3MgPSBjdXJyZW50LnBvcztcblxuICAgICAgc2VsZi50cmlnZ2VyKFwiYmVmb3JlU2hvd1wiLCBmaXJzdFJ1bik7XG5cbiAgICAgIHNlbGYudXBkYXRlQ29udHJvbHMoKTtcblxuICAgICAgY3VycmVudFBvcyA9ICQuZmFuY3lib3guZ2V0VHJhbnNsYXRlKGN1cnJlbnQuJHNsaWRlKTtcblxuICAgICAgY3VycmVudC5pc01vdmVkID0gKGN1cnJlbnRQb3MubGVmdCAhPT0gMCB8fCBjdXJyZW50UG9zLnRvcCAhPT0gMCkgJiYgIWN1cnJlbnQuJHNsaWRlLmhhc0NsYXNzKFwiZmFuY3lib3gtYW5pbWF0ZWRcIik7XG5cbiAgICAgIC8vIFZhbGlkYXRlIGR1cmF0aW9uIGxlbmd0aFxuICAgICAgY3VycmVudC5mb3JjZWREdXJhdGlvbiA9IHVuZGVmaW5lZDtcblxuICAgICAgaWYgKCQuaXNOdW1lcmljKGR1cmF0aW9uKSkge1xuICAgICAgICBjdXJyZW50LmZvcmNlZER1cmF0aW9uID0gZHVyYXRpb247XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkdXJhdGlvbiA9IGN1cnJlbnQub3B0c1tmaXJzdFJ1biA/IFwiYW5pbWF0aW9uRHVyYXRpb25cIiA6IFwidHJhbnNpdGlvbkR1cmF0aW9uXCJdO1xuICAgICAgfVxuXG4gICAgICBkdXJhdGlvbiA9IHBhcnNlSW50KGR1cmF0aW9uLCAxMCk7XG5cbiAgICAgIC8vIEZyZXNoIHN0YXJ0IC0gcmV2ZWFsIGNvbnRhaW5lciwgY3VycmVudCBzbGlkZSBhbmQgc3RhcnQgbG9hZGluZyBjb250ZW50XG4gICAgICBpZiAoZmlyc3RSdW4pIHtcbiAgICAgICAgaWYgKGN1cnJlbnQub3B0cy5hbmltYXRpb25FZmZlY3QgJiYgZHVyYXRpb24pIHtcbiAgICAgICAgICBzZWxmLiRyZWZzLmNvbnRhaW5lci5jc3MoXCJ0cmFuc2l0aW9uLWR1cmF0aW9uXCIsIGR1cmF0aW9uICsgXCJtc1wiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuJHJlZnMuY29udGFpbmVyLnJlbW92ZUNsYXNzKFwiZmFuY3lib3gtaXMtaGlkZGVuXCIpO1xuXG4gICAgICAgIGZvcmNlUmVkcmF3KHNlbGYuJHJlZnMuY29udGFpbmVyKTtcblxuICAgICAgICBzZWxmLiRyZWZzLmNvbnRhaW5lci5hZGRDbGFzcyhcImZhbmN5Ym94LWlzLW9wZW5cIik7XG5cbiAgICAgICAgZm9yY2VSZWRyYXcoc2VsZi4kcmVmcy5jb250YWluZXIpO1xuXG4gICAgICAgIC8vIE1ha2UgY3VycmVudCBzbGlkZSB2aXNpYmxlXG4gICAgICAgIGN1cnJlbnQuJHNsaWRlLmFkZENsYXNzKFwiZmFuY3lib3gtc2xpZGUtLXByZXZpb3VzXCIpO1xuXG4gICAgICAgIC8vIEF0dGVtcHQgdG8gbG9hZCBjb250ZW50IGludG8gc2xpZGU7XG4gICAgICAgIC8vIGF0IHRoaXMgcG9pbnQgaW1hZ2Ugd291bGQgc3RhcnQgbG9hZGluZywgYnV0IGlubGluZS9odG1sIGNvbnRlbnQgd291bGQgbG9hZCBpbW1lZGlhdGVseVxuICAgICAgICBzZWxmLmxvYWRTbGlkZShjdXJyZW50KTtcblxuICAgICAgICBjdXJyZW50LiRzbGlkZS5yZW1vdmVDbGFzcyhcImZhbmN5Ym94LXNsaWRlLS1wcmV2aW91c1wiKS5hZGRDbGFzcyhcImZhbmN5Ym94LXNsaWRlLS1jdXJyZW50XCIpO1xuXG4gICAgICAgIHNlbGYucHJlbG9hZChcImltYWdlXCIpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gQ2xlYW4gdXBcbiAgICAgICQuZWFjaChzZWxmLnNsaWRlcywgZnVuY3Rpb24oaW5kZXgsIHNsaWRlKSB7XG4gICAgICAgICQuZmFuY3lib3guc3RvcChzbGlkZS4kc2xpZGUpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIE1ha2UgY3VycmVudCB0aGF0IHNsaWRlIGlzIHZpc2libGUgZXZlbiBpZiBjb250ZW50IGlzIHN0aWxsIGxvYWRpbmdcbiAgICAgIGN1cnJlbnQuJHNsaWRlLnJlbW92ZUNsYXNzKFwiZmFuY3lib3gtc2xpZGUtLW5leHQgZmFuY3lib3gtc2xpZGUtLXByZXZpb3VzXCIpLmFkZENsYXNzKFwiZmFuY3lib3gtc2xpZGUtLWN1cnJlbnRcIik7XG5cbiAgICAgIC8vIElmIHNsaWRlcyBoYXZlIGJlZW4gZHJhZ2dlZCwgYW5pbWF0ZSB0aGVtIHRvIGNvcnJlY3QgcG9zaXRpb25cbiAgICAgIGlmIChjdXJyZW50LmlzTW92ZWQpIHtcbiAgICAgICAgY2FudmFzV2lkdGggPSBNYXRoLnJvdW5kKGN1cnJlbnQuJHNsaWRlLndpZHRoKCkpO1xuXG4gICAgICAgICQuZWFjaChzZWxmLnNsaWRlcywgZnVuY3Rpb24oaW5kZXgsIHNsaWRlKSB7XG4gICAgICAgICAgdmFyIHBvcyA9IHNsaWRlLnBvcyAtIGN1cnJlbnQucG9zO1xuXG4gICAgICAgICAgJC5mYW5jeWJveC5hbmltYXRlKFxuICAgICAgICAgICAgc2xpZGUuJHNsaWRlLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgICAgIGxlZnQ6IHBvcyAqIGNhbnZhc1dpZHRoICsgcG9zICogc2xpZGUub3B0cy5ndXR0ZXJcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICBzbGlkZS4kc2xpZGUucmVtb3ZlQXR0cihcInN0eWxlXCIpLnJlbW92ZUNsYXNzKFwiZmFuY3lib3gtc2xpZGUtLW5leHQgZmFuY3lib3gtc2xpZGUtLXByZXZpb3VzXCIpO1xuXG4gICAgICAgICAgICAgIGlmIChzbGlkZS5wb3MgPT09IHNlbGYuY3VyclBvcykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnQuaXNNb3ZlZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgc2VsZi5jb21wbGV0ZSgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLiRyZWZzLnN0YWdlLmNoaWxkcmVuKCkucmVtb3ZlQXR0cihcInN0eWxlXCIpO1xuICAgICAgfVxuXG4gICAgICAvLyBTdGFydCB0cmFuc2l0aW9uIHRoYXQgcmV2ZWFscyBjdXJyZW50IGNvbnRlbnRcbiAgICAgIC8vIG9yIHdhaXQgd2hlbiBpdCB3aWxsIGJlIGxvYWRlZFxuXG4gICAgICBpZiAoY3VycmVudC5pc0xvYWRlZCkge1xuICAgICAgICBzZWxmLnJldmVhbENvbnRlbnQoY3VycmVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWxmLmxvYWRTbGlkZShjdXJyZW50KTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5wcmVsb2FkKFwiaW1hZ2VcIik7XG5cbiAgICAgIGlmIChwcmV2aW91cy5wb3MgPT09IGN1cnJlbnQucG9zKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gSGFuZGxlIHByZXZpb3VzIHNsaWRlXG4gICAgICAvLyA9PT09PT09PT09PT09PT09PT09PT1cblxuICAgICAgdHJhbnNpdGlvblByb3BzID0gXCJmYW5jeWJveC1zbGlkZS0tXCIgKyAocHJldmlvdXMucG9zID4gY3VycmVudC5wb3MgPyBcIm5leHRcIiA6IFwicHJldmlvdXNcIik7XG5cbiAgICAgIHByZXZpb3VzLiRzbGlkZS5yZW1vdmVDbGFzcyhcImZhbmN5Ym94LXNsaWRlLS1jb21wbGV0ZSBmYW5jeWJveC1zbGlkZS0tY3VycmVudCBmYW5jeWJveC1zbGlkZS0tbmV4dCBmYW5jeWJveC1zbGlkZS0tcHJldmlvdXNcIik7XG5cbiAgICAgIHByZXZpb3VzLmlzQ29tcGxldGUgPSBmYWxzZTtcblxuICAgICAgaWYgKCFkdXJhdGlvbiB8fCAoIWN1cnJlbnQuaXNNb3ZlZCAmJiAhY3VycmVudC5vcHRzLnRyYW5zaXRpb25FZmZlY3QpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGN1cnJlbnQuaXNNb3ZlZCkge1xuICAgICAgICBwcmV2aW91cy4kc2xpZGUuYWRkQ2xhc3ModHJhbnNpdGlvblByb3BzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyYW5zaXRpb25Qcm9wcyA9IFwiZmFuY3lib3gtYW5pbWF0ZWQgXCIgKyB0cmFuc2l0aW9uUHJvcHMgKyBcIiBmYW5jeWJveC1meC1cIiArIGN1cnJlbnQub3B0cy50cmFuc2l0aW9uRWZmZWN0O1xuXG4gICAgICAgICQuZmFuY3lib3guYW5pbWF0ZShwcmV2aW91cy4kc2xpZGUsIHRyYW5zaXRpb25Qcm9wcywgZHVyYXRpb24sIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHByZXZpb3VzLiRzbGlkZS5yZW1vdmVDbGFzcyh0cmFuc2l0aW9uUHJvcHMpLnJlbW92ZUF0dHIoXCJzdHlsZVwiKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIENyZWF0ZSBuZXcgXCJzbGlkZVwiIGVsZW1lbnRcbiAgICAvLyBUaGVzZSBhcmUgZ2FsbGVyeSBpdGVtcyAgdGhhdCBhcmUgYWN0dWFsbHkgYWRkZWQgdG8gRE9NXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY3JlYXRlU2xpZGU6IGZ1bmN0aW9uKHBvcykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAkc2xpZGUsXG4gICAgICAgIGluZGV4O1xuXG4gICAgICBpbmRleCA9IHBvcyAlIHNlbGYuZ3JvdXAubGVuZ3RoO1xuICAgICAgaW5kZXggPSBpbmRleCA8IDAgPyBzZWxmLmdyb3VwLmxlbmd0aCArIGluZGV4IDogaW5kZXg7XG5cbiAgICAgIGlmICghc2VsZi5zbGlkZXNbcG9zXSAmJiBzZWxmLmdyb3VwW2luZGV4XSkge1xuICAgICAgICAkc2xpZGUgPSAkKCc8ZGl2IGNsYXNzPVwiZmFuY3lib3gtc2xpZGVcIj48L2Rpdj4nKS5hcHBlbmRUbyhzZWxmLiRyZWZzLnN0YWdlKTtcblxuICAgICAgICBzZWxmLnNsaWRlc1twb3NdID0gJC5leHRlbmQodHJ1ZSwge30sIHNlbGYuZ3JvdXBbaW5kZXhdLCB7XG4gICAgICAgICAgcG9zOiBwb3MsXG4gICAgICAgICAgJHNsaWRlOiAkc2xpZGUsXG4gICAgICAgICAgaXNMb2FkZWQ6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNlbGYudXBkYXRlU2xpZGUoc2VsZi5zbGlkZXNbcG9zXSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzZWxmLnNsaWRlc1twb3NdO1xuICAgIH0sXG5cbiAgICAvLyBTY2FsZSBpbWFnZSB0byB0aGUgYWN0dWFsIHNpemUgb2YgdGhlIGltYWdlO1xuICAgIC8vIHggYW5kIHkgdmFsdWVzIHNob3VsZCBiZSByZWxhdGl2ZSB0byB0aGUgc2xpZGVcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBzY2FsZVRvQWN0dWFsOiBmdW5jdGlvbih4LCB5LCBkdXJhdGlvbikge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBjdXJyZW50ID0gc2VsZi5jdXJyZW50LFxuICAgICAgICAkY29udGVudCA9IGN1cnJlbnQuJGNvbnRlbnQsXG4gICAgICAgIGNhbnZhc1dpZHRoID0gJC5mYW5jeWJveC5nZXRUcmFuc2xhdGUoY3VycmVudC4kc2xpZGUpLndpZHRoLFxuICAgICAgICBjYW52YXNIZWlnaHQgPSAkLmZhbmN5Ym94LmdldFRyYW5zbGF0ZShjdXJyZW50LiRzbGlkZSkuaGVpZ2h0LFxuICAgICAgICBuZXdJbWdXaWR0aCA9IGN1cnJlbnQud2lkdGgsXG4gICAgICAgIG5ld0ltZ0hlaWdodCA9IGN1cnJlbnQuaGVpZ2h0LFxuICAgICAgICBpbWdQb3MsXG4gICAgICAgIHBvc1gsXG4gICAgICAgIHBvc1ksXG4gICAgICAgIHNjYWxlWCxcbiAgICAgICAgc2NhbGVZO1xuXG4gICAgICBpZiAoc2VsZi5pc0FuaW1hdGluZyB8fCAhJGNvbnRlbnQgfHwgIShjdXJyZW50LnR5cGUgPT0gXCJpbWFnZVwiICYmIGN1cnJlbnQuaXNMb2FkZWQgJiYgIWN1cnJlbnQuaGFzRXJyb3IpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgJC5mYW5jeWJveC5zdG9wKCRjb250ZW50KTtcblxuICAgICAgc2VsZi5pc0FuaW1hdGluZyA9IHRydWU7XG5cbiAgICAgIHggPSB4ID09PSB1bmRlZmluZWQgPyBjYW52YXNXaWR0aCAqIDAuNSA6IHg7XG4gICAgICB5ID0geSA9PT0gdW5kZWZpbmVkID8gY2FudmFzSGVpZ2h0ICogMC41IDogeTtcblxuICAgICAgaW1nUG9zID0gJC5mYW5jeWJveC5nZXRUcmFuc2xhdGUoJGNvbnRlbnQpO1xuXG4gICAgICBpbWdQb3MudG9wIC09ICQuZmFuY3lib3guZ2V0VHJhbnNsYXRlKGN1cnJlbnQuJHNsaWRlKS50b3A7XG4gICAgICBpbWdQb3MubGVmdCAtPSAkLmZhbmN5Ym94LmdldFRyYW5zbGF0ZShjdXJyZW50LiRzbGlkZSkubGVmdDtcblxuICAgICAgc2NhbGVYID0gbmV3SW1nV2lkdGggLyBpbWdQb3Mud2lkdGg7XG4gICAgICBzY2FsZVkgPSBuZXdJbWdIZWlnaHQgLyBpbWdQb3MuaGVpZ2h0O1xuXG4gICAgICAvLyBHZXQgY2VudGVyIHBvc2l0aW9uIGZvciBvcmlnaW5hbCBpbWFnZVxuICAgICAgcG9zWCA9IGNhbnZhc1dpZHRoICogMC41IC0gbmV3SW1nV2lkdGggKiAwLjU7XG4gICAgICBwb3NZID0gY2FudmFzSGVpZ2h0ICogMC41IC0gbmV3SW1nSGVpZ2h0ICogMC41O1xuXG4gICAgICAvLyBNYWtlIHN1cmUgaW1hZ2UgZG9lcyBub3QgbW92ZSBhd2F5IGZyb20gZWRnZXNcbiAgICAgIGlmIChuZXdJbWdXaWR0aCA+IGNhbnZhc1dpZHRoKSB7XG4gICAgICAgIHBvc1ggPSBpbWdQb3MubGVmdCAqIHNjYWxlWCAtICh4ICogc2NhbGVYIC0geCk7XG5cbiAgICAgICAgaWYgKHBvc1ggPiAwKSB7XG4gICAgICAgICAgcG9zWCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocG9zWCA8IGNhbnZhc1dpZHRoIC0gbmV3SW1nV2lkdGgpIHtcbiAgICAgICAgICBwb3NYID0gY2FudmFzV2lkdGggLSBuZXdJbWdXaWR0aDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobmV3SW1nSGVpZ2h0ID4gY2FudmFzSGVpZ2h0KSB7XG4gICAgICAgIHBvc1kgPSBpbWdQb3MudG9wICogc2NhbGVZIC0gKHkgKiBzY2FsZVkgLSB5KTtcblxuICAgICAgICBpZiAocG9zWSA+IDApIHtcbiAgICAgICAgICBwb3NZID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwb3NZIDwgY2FudmFzSGVpZ2h0IC0gbmV3SW1nSGVpZ2h0KSB7XG4gICAgICAgICAgcG9zWSA9IGNhbnZhc0hlaWdodCAtIG5ld0ltZ0hlaWdodDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzZWxmLnVwZGF0ZUN1cnNvcihuZXdJbWdXaWR0aCwgbmV3SW1nSGVpZ2h0KTtcblxuICAgICAgJC5mYW5jeWJveC5hbmltYXRlKFxuICAgICAgICAkY29udGVudCxcbiAgICAgICAge1xuICAgICAgICAgIHRvcDogcG9zWSxcbiAgICAgICAgICBsZWZ0OiBwb3NYLFxuICAgICAgICAgIHNjYWxlWDogc2NhbGVYLFxuICAgICAgICAgIHNjYWxlWTogc2NhbGVZXG4gICAgICAgIH0sXG4gICAgICAgIGR1cmF0aW9uIHx8IDMzMCxcbiAgICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgc2VsZi5pc0FuaW1hdGluZyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICAvLyBTdG9wIHNsaWRlc2hvd1xuICAgICAgaWYgKHNlbGYuU2xpZGVTaG93ICYmIHNlbGYuU2xpZGVTaG93LmlzQWN0aXZlKSB7XG4gICAgICAgIHNlbGYuU2xpZGVTaG93LnN0b3AoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gU2NhbGUgaW1hZ2UgdG8gZml0IGluc2lkZSBwYXJlbnQgZWxlbWVudFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHNjYWxlVG9GaXQ6IGZ1bmN0aW9uKGR1cmF0aW9uKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIGN1cnJlbnQgPSBzZWxmLmN1cnJlbnQsXG4gICAgICAgICRjb250ZW50ID0gY3VycmVudC4kY29udGVudCxcbiAgICAgICAgZW5kO1xuXG4gICAgICBpZiAoc2VsZi5pc0FuaW1hdGluZyB8fCAhJGNvbnRlbnQgfHwgIShjdXJyZW50LnR5cGUgPT0gXCJpbWFnZVwiICYmIGN1cnJlbnQuaXNMb2FkZWQgJiYgIWN1cnJlbnQuaGFzRXJyb3IpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgJC5mYW5jeWJveC5zdG9wKCRjb250ZW50KTtcblxuICAgICAgc2VsZi5pc0FuaW1hdGluZyA9IHRydWU7XG5cbiAgICAgIGVuZCA9IHNlbGYuZ2V0Rml0UG9zKGN1cnJlbnQpO1xuXG4gICAgICBzZWxmLnVwZGF0ZUN1cnNvcihlbmQud2lkdGgsIGVuZC5oZWlnaHQpO1xuXG4gICAgICAkLmZhbmN5Ym94LmFuaW1hdGUoXG4gICAgICAgICRjb250ZW50LFxuICAgICAgICB7XG4gICAgICAgICAgdG9wOiBlbmQudG9wLFxuICAgICAgICAgIGxlZnQ6IGVuZC5sZWZ0LFxuICAgICAgICAgIHNjYWxlWDogZW5kLndpZHRoIC8gJGNvbnRlbnQud2lkdGgoKSxcbiAgICAgICAgICBzY2FsZVk6IGVuZC5oZWlnaHQgLyAkY29udGVudC5oZWlnaHQoKVxuICAgICAgICB9LFxuICAgICAgICBkdXJhdGlvbiB8fCAzMzAsXG4gICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHNlbGYuaXNBbmltYXRpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9LFxuXG4gICAgLy8gQ2FsY3VsYXRlIGltYWdlIHNpemUgdG8gZml0IGluc2lkZSB2aWV3cG9ydFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGdldEZpdFBvczogZnVuY3Rpb24oc2xpZGUpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgJGNvbnRlbnQgPSBzbGlkZS4kY29udGVudCxcbiAgICAgICAgd2lkdGggPSBzbGlkZS53aWR0aCB8fCBzbGlkZS5vcHRzLndpZHRoLFxuICAgICAgICBoZWlnaHQgPSBzbGlkZS5oZWlnaHQgfHwgc2xpZGUub3B0cy5oZWlnaHQsXG4gICAgICAgIG1heFdpZHRoLFxuICAgICAgICBtYXhIZWlnaHQsXG4gICAgICAgIG1pblJhdGlvLFxuICAgICAgICBtYXJnaW4sXG4gICAgICAgIGFzcGVjdFJhdGlvLFxuICAgICAgICByZXogPSB7fTtcblxuICAgICAgaWYgKCFzbGlkZS5pc0xvYWRlZCB8fCAhJGNvbnRlbnQgfHwgISRjb250ZW50Lmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIG1hcmdpbiA9IHtcbiAgICAgICAgdG9wOiBwYXJzZUludChzbGlkZS4kc2xpZGUuY3NzKFwicGFkZGluZ1RvcFwiKSwgMTApLFxuICAgICAgICByaWdodDogcGFyc2VJbnQoc2xpZGUuJHNsaWRlLmNzcyhcInBhZGRpbmdSaWdodFwiKSwgMTApLFxuICAgICAgICBib3R0b206IHBhcnNlSW50KHNsaWRlLiRzbGlkZS5jc3MoXCJwYWRkaW5nQm90dG9tXCIpLCAxMCksXG4gICAgICAgIGxlZnQ6IHBhcnNlSW50KHNsaWRlLiRzbGlkZS5jc3MoXCJwYWRkaW5nTGVmdFwiKSwgMTApXG4gICAgICB9O1xuXG4gICAgICAvLyBXZSBjYW4gbm90IHVzZSAkc2xpZGUgd2lkdGggaGVyZSwgYmVjYXVzZSBpdCBjYW4gaGF2ZSBkaWZmZXJlbnQgZGllbWVuc2lvbnMgd2hpbGUgaW4gdHJhbnNpdG9uXG4gICAgICBtYXhXaWR0aCA9IHBhcnNlSW50KHNlbGYuJHJlZnMuc3RhZ2Uud2lkdGgoKSwgMTApIC0gKG1hcmdpbi5sZWZ0ICsgbWFyZ2luLnJpZ2h0KTtcbiAgICAgIG1heEhlaWdodCA9IHBhcnNlSW50KHNlbGYuJHJlZnMuc3RhZ2UuaGVpZ2h0KCksIDEwKSAtIChtYXJnaW4udG9wICsgbWFyZ2luLmJvdHRvbSk7XG5cbiAgICAgIGlmICghd2lkdGggfHwgIWhlaWdodCkge1xuICAgICAgICB3aWR0aCA9IG1heFdpZHRoO1xuICAgICAgICBoZWlnaHQgPSBtYXhIZWlnaHQ7XG4gICAgICB9XG5cbiAgICAgIG1pblJhdGlvID0gTWF0aC5taW4oMSwgbWF4V2lkdGggLyB3aWR0aCwgbWF4SGVpZ2h0IC8gaGVpZ2h0KTtcblxuICAgICAgLy8gVXNlIGZsb29yIHJvdW5kaW5nIHRvIG1ha2Ugc3VyZSBpdCByZWFsbHkgZml0c1xuICAgICAgd2lkdGggPSBNYXRoLmZsb29yKG1pblJhdGlvICogd2lkdGgpO1xuICAgICAgaGVpZ2h0ID0gTWF0aC5mbG9vcihtaW5SYXRpbyAqIGhlaWdodCk7XG5cbiAgICAgIGlmIChzbGlkZS50eXBlID09PSBcImltYWdlXCIpIHtcbiAgICAgICAgcmV6LnRvcCA9IE1hdGguZmxvb3IoKG1heEhlaWdodCAtIGhlaWdodCkgKiAwLjUpICsgbWFyZ2luLnRvcDtcbiAgICAgICAgcmV6LmxlZnQgPSBNYXRoLmZsb29yKChtYXhXaWR0aCAtIHdpZHRoKSAqIDAuNSkgKyBtYXJnaW4ubGVmdDtcbiAgICAgIH0gZWxzZSBpZiAoc2xpZGUuY29udGVudFR5cGUgPT09IFwidmlkZW9cIikge1xuICAgICAgICAvLyBGb3JjZSBhc3BlY3QgcmF0aW8gZm9yIHRoZSB2aWRlb1xuICAgICAgICAvLyBcIkkgc2F5IHRoZSB3aG9sZSB3b3JsZCBtdXN0IGxlYXJuIG9mIG91ciBwZWFjZWZ1bCB3YXlz4oCmIGJ5IGZvcmNlIVwiXG4gICAgICAgIGFzcGVjdFJhdGlvID0gc2xpZGUub3B0cy53aWR0aCAmJiBzbGlkZS5vcHRzLmhlaWdodCA/IHdpZHRoIC8gaGVpZ2h0IDogc2xpZGUub3B0cy5yYXRpbyB8fCAxNiAvIDk7XG5cbiAgICAgICAgaWYgKGhlaWdodCA+IHdpZHRoIC8gYXNwZWN0UmF0aW8pIHtcbiAgICAgICAgICBoZWlnaHQgPSB3aWR0aCAvIGFzcGVjdFJhdGlvO1xuICAgICAgICB9IGVsc2UgaWYgKHdpZHRoID4gaGVpZ2h0ICogYXNwZWN0UmF0aW8pIHtcbiAgICAgICAgICB3aWR0aCA9IGhlaWdodCAqIGFzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJlei53aWR0aCA9IHdpZHRoO1xuICAgICAgcmV6LmhlaWdodCA9IGhlaWdodDtcblxuICAgICAgcmV0dXJuIHJlejtcbiAgICB9LFxuXG4gICAgLy8gVXBkYXRlIGNvbnRlbnQgc2l6ZSBhbmQgcG9zaXRpb24gZm9yIGFsbCBzbGlkZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICB1cGRhdGU6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAkLmVhY2goc2VsZi5zbGlkZXMsIGZ1bmN0aW9uKGtleSwgc2xpZGUpIHtcbiAgICAgICAgc2VsZi51cGRhdGVTbGlkZShzbGlkZSk7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgLy8gVXBkYXRlIHNsaWRlIGNvbnRlbnQgcG9zaXRpb24gYW5kIHNpemVcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdXBkYXRlU2xpZGU6IGZ1bmN0aW9uKHNsaWRlLCBkdXJhdGlvbikge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAkY29udGVudCA9IHNsaWRlICYmIHNsaWRlLiRjb250ZW50LFxuICAgICAgICB3aWR0aCA9IHNsaWRlLndpZHRoIHx8IHNsaWRlLm9wdHMud2lkdGgsXG4gICAgICAgIGhlaWdodCA9IHNsaWRlLmhlaWdodCB8fCBzbGlkZS5vcHRzLmhlaWdodDtcblxuICAgICAgaWYgKCRjb250ZW50ICYmICh3aWR0aCB8fCBoZWlnaHQgfHwgc2xpZGUuY29udGVudFR5cGUgPT09IFwidmlkZW9cIikgJiYgIXNsaWRlLmhhc0Vycm9yKSB7XG4gICAgICAgICQuZmFuY3lib3guc3RvcCgkY29udGVudCk7XG5cbiAgICAgICAgJC5mYW5jeWJveC5zZXRUcmFuc2xhdGUoJGNvbnRlbnQsIHNlbGYuZ2V0Rml0UG9zKHNsaWRlKSk7XG5cbiAgICAgICAgaWYgKHNsaWRlLnBvcyA9PT0gc2VsZi5jdXJyUG9zKSB7XG4gICAgICAgICAgc2VsZi5pc0FuaW1hdGluZyA9IGZhbHNlO1xuXG4gICAgICAgICAgc2VsZi51cGRhdGVDdXJzb3IoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzbGlkZS4kc2xpZGUudHJpZ2dlcihcInJlZnJlc2hcIik7XG5cbiAgICAgIHNlbGYuJHJlZnMudG9vbGJhci50b2dnbGVDbGFzcyhcImNvbXBlbnNhdGUtZm9yLXNjcm9sbGJhclwiLCBzbGlkZS4kc2xpZGUuZ2V0KDApLnNjcm9sbEhlaWdodCA+IHNsaWRlLiRzbGlkZS5nZXQoMCkuY2xpZW50SGVpZ2h0KTtcblxuICAgICAgc2VsZi50cmlnZ2VyKFwib25VcGRhdGVcIiwgc2xpZGUpO1xuICAgIH0sXG5cbiAgICAvLyBIb3Jpem9udGFsbHkgY2VudGVyIHNsaWRlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY2VudGVyU2xpZGU6IGZ1bmN0aW9uKHNsaWRlLCBkdXJhdGlvbikge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBjYW52YXNXaWR0aCxcbiAgICAgICAgcG9zO1xuXG4gICAgICBpZiAoc2VsZi5jdXJyZW50KSB7XG4gICAgICAgIGNhbnZhc1dpZHRoID0gTWF0aC5yb3VuZChzbGlkZS4kc2xpZGUud2lkdGgoKSk7XG4gICAgICAgIHBvcyA9IHNsaWRlLnBvcyAtIHNlbGYuY3VycmVudC5wb3M7XG5cbiAgICAgICAgJC5mYW5jeWJveC5hbmltYXRlKFxuICAgICAgICAgIHNsaWRlLiRzbGlkZSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgICBsZWZ0OiBwb3MgKiBjYW52YXNXaWR0aCArIHBvcyAqIHNsaWRlLm9wdHMuZ3V0dGVyLFxuICAgICAgICAgICAgb3BhY2l0eTogMVxuICAgICAgICAgIH0sXG4gICAgICAgICAgZHVyYXRpb24gPT09IHVuZGVmaW5lZCA/IDAgOiBkdXJhdGlvbixcbiAgICAgICAgICBudWxsLFxuICAgICAgICAgIGZhbHNlXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIFVwZGF0ZSBjdXJzb3Igc3R5bGUgZGVwZW5kaW5nIGlmIGNvbnRlbnQgY2FuIGJlIHpvb21lZFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdXBkYXRlQ3Vyc29yOiBmdW5jdGlvbihuZXh0V2lkdGgsIG5leHRIZWlnaHQpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgY3VycmVudCA9IHNlbGYuY3VycmVudCxcbiAgICAgICAgJGNvbnRhaW5lciA9IHNlbGYuJHJlZnMuY29udGFpbmVyLnJlbW92ZUNsYXNzKFwiZmFuY3lib3gtaXMtem9vbWFibGUgZmFuY3lib3gtY2FuLXpvb21JbiBmYW5jeWJveC1jYW4tZHJhZyBmYW5jeWJveC1jYW4tem9vbU91dFwiKSxcbiAgICAgICAgaXNab29tYWJsZTtcblxuICAgICAgaWYgKCFjdXJyZW50IHx8IHNlbGYuaXNDbG9zaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaXNab29tYWJsZSA9IHNlbGYuaXNab29tYWJsZSgpO1xuXG4gICAgICAkY29udGFpbmVyLnRvZ2dsZUNsYXNzKFwiZmFuY3lib3gtaXMtem9vbWFibGVcIiwgaXNab29tYWJsZSk7XG5cbiAgICAgICQoXCJbZGF0YS1mYW5jeWJveC16b29tXVwiKS5wcm9wKFwiZGlzYWJsZWRcIiwgIWlzWm9vbWFibGUpO1xuXG4gICAgICAvLyBTZXQgY3Vyc29yIHRvIHpvb20gaW4vb3V0IGlmIGNsaWNrIGV2ZW50IGlzICd6b29tJ1xuICAgICAgaWYgKFxuICAgICAgICBpc1pvb21hYmxlICYmXG4gICAgICAgIChjdXJyZW50Lm9wdHMuY2xpY2tDb250ZW50ID09PSBcInpvb21cIiB8fCAoJC5pc0Z1bmN0aW9uKGN1cnJlbnQub3B0cy5jbGlja0NvbnRlbnQpICYmIGN1cnJlbnQub3B0cy5jbGlja0NvbnRlbnQoY3VycmVudCkgPT09IFwiem9vbVwiKSlcbiAgICAgICkge1xuICAgICAgICBpZiAoc2VsZi5pc1NjYWxlZERvd24obmV4dFdpZHRoLCBuZXh0SGVpZ2h0KSkge1xuICAgICAgICAgIC8vIElmIGltYWdlIGlzIHNjYWxlZCBkb3duLCB0aGVuLCBvYnZpb3VzbHksIGl0IGNhbiBiZSB6b29tZWQgdG8gZnVsbCBzaXplXG4gICAgICAgICAgJGNvbnRhaW5lci5hZGRDbGFzcyhcImZhbmN5Ym94LWNhbi16b29tSW5cIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGN1cnJlbnQub3B0cy50b3VjaCkge1xuICAgICAgICAgICAgLy8gSWYgaW1hZ2Ugc2l6ZSBpciBsYXJnZW4gdGhhbiBhdmFpbGFibGUgYXZhaWxhYmxlIGFuZCB0b3VjaCBtb2R1bGUgaXMgbm90IGRpc2FibGUsXG4gICAgICAgICAgICAvLyB0aGVuIHVzZXIgY2FuIGRvIHBhbm5pbmdcbiAgICAgICAgICAgICRjb250YWluZXIuYWRkQ2xhc3MoXCJmYW5jeWJveC1jYW4tZHJhZ1wiKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgJGNvbnRhaW5lci5hZGRDbGFzcyhcImZhbmN5Ym94LWNhbi16b29tT3V0XCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChjdXJyZW50Lm9wdHMudG91Y2ggJiYgY3VycmVudC5jb250ZW50VHlwZSAhPT0gXCJ2aWRlb1wiKSB7XG4gICAgICAgICRjb250YWluZXIuYWRkQ2xhc3MoXCJmYW5jeWJveC1jYW4tZHJhZ1wiKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gQ2hlY2sgaWYgY3VycmVudCBzbGlkZSBpcyB6b29tYWJsZVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGlzWm9vbWFibGU6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBjdXJyZW50ID0gc2VsZi5jdXJyZW50LFxuICAgICAgICBmaXRQb3M7XG5cbiAgICAgIC8vIEFzc3VtZSB0aGF0IHNsaWRlIGlzIHpvb21hYmxlIGlmOlxuICAgICAgLy8gICAtIGltYWdlIGlzIHN0aWxsIGxvYWRpbmdcbiAgICAgIC8vICAgLSBhY3R1YWwgc2l6ZSBvZiB0aGUgaW1hZ2UgaXMgc21hbGxlciB0aGFuIGF2YWlsYWJsZSBhcmVhXG4gICAgICBpZiAoY3VycmVudCAmJiAhc2VsZi5pc0Nsb3NpbmcgJiYgY3VycmVudC50eXBlID09PSBcImltYWdlXCIgJiYgIWN1cnJlbnQuaGFzRXJyb3IpIHtcbiAgICAgICAgaWYgKCFjdXJyZW50LmlzTG9hZGVkKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBmaXRQb3MgPSBzZWxmLmdldEZpdFBvcyhjdXJyZW50KTtcblxuICAgICAgICBpZiAoY3VycmVudC53aWR0aCA+IGZpdFBvcy53aWR0aCB8fCBjdXJyZW50LmhlaWdodCA+IGZpdFBvcy5oZWlnaHQpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAgIC8vIENoZWNrIGlmIGN1cnJlbnQgaW1hZ2UgZGltZW5zaW9ucyBhcmUgc21hbGxlciB0aGFuIGFjdHVhbFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgaXNTY2FsZWREb3duOiBmdW5jdGlvbihuZXh0V2lkdGgsIG5leHRIZWlnaHQpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgcmV6ID0gZmFsc2UsXG4gICAgICAgIGN1cnJlbnQgPSBzZWxmLmN1cnJlbnQsXG4gICAgICAgICRjb250ZW50ID0gY3VycmVudC4kY29udGVudDtcblxuICAgICAgaWYgKG5leHRXaWR0aCAhPT0gdW5kZWZpbmVkICYmIG5leHRIZWlnaHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXogPSBuZXh0V2lkdGggPCBjdXJyZW50LndpZHRoICYmIG5leHRIZWlnaHQgPCBjdXJyZW50LmhlaWdodDtcbiAgICAgIH0gZWxzZSBpZiAoJGNvbnRlbnQpIHtcbiAgICAgICAgcmV6ID0gJC5mYW5jeWJveC5nZXRUcmFuc2xhdGUoJGNvbnRlbnQpO1xuICAgICAgICByZXogPSByZXoud2lkdGggPCBjdXJyZW50LndpZHRoICYmIHJlei5oZWlnaHQgPCBjdXJyZW50LmhlaWdodDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlejtcbiAgICB9LFxuXG4gICAgLy8gQ2hlY2sgaWYgaW1hZ2UgZGltZW5zaW9ucyBleGNlZWQgcGFyZW50IGVsZW1lbnRcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY2FuUGFuOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgcmV6ID0gZmFsc2UsXG4gICAgICAgIGN1cnJlbnQgPSBzZWxmLmN1cnJlbnQsXG4gICAgICAgICRjb250ZW50O1xuXG4gICAgICBpZiAoY3VycmVudC50eXBlID09PSBcImltYWdlXCIgJiYgKCRjb250ZW50ID0gY3VycmVudC4kY29udGVudCkgJiYgIWN1cnJlbnQuaGFzRXJyb3IpIHtcbiAgICAgICAgcmV6ID0gc2VsZi5nZXRGaXRQb3MoY3VycmVudCk7XG4gICAgICAgIHJleiA9IE1hdGguYWJzKCRjb250ZW50LndpZHRoKCkgLSByZXoud2lkdGgpID4gMSB8fCBNYXRoLmFicygkY29udGVudC5oZWlnaHQoKSAtIHJlei5oZWlnaHQpID4gMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlejtcbiAgICB9LFxuXG4gICAgLy8gTG9hZCBjb250ZW50IGludG8gdGhlIHNsaWRlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBsb2FkU2xpZGU6IGZ1bmN0aW9uKHNsaWRlKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIHR5cGUsXG4gICAgICAgICRzbGlkZSxcbiAgICAgICAgYWpheExvYWQ7XG5cbiAgICAgIGlmIChzbGlkZS5pc0xvYWRpbmcgfHwgc2xpZGUuaXNMb2FkZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBzbGlkZS5pc0xvYWRpbmcgPSB0cnVlO1xuXG4gICAgICBzZWxmLnRyaWdnZXIoXCJiZWZvcmVMb2FkXCIsIHNsaWRlKTtcblxuICAgICAgdHlwZSA9IHNsaWRlLnR5cGU7XG4gICAgICAkc2xpZGUgPSBzbGlkZS4kc2xpZGU7XG5cbiAgICAgICRzbGlkZVxuICAgICAgICAub2ZmKFwicmVmcmVzaFwiKVxuICAgICAgICAudHJpZ2dlcihcIm9uUmVzZXRcIilcbiAgICAgICAgLmFkZENsYXNzKHNsaWRlLm9wdHMuc2xpZGVDbGFzcyk7XG5cbiAgICAgIC8vIENyZWF0ZSBjb250ZW50IGRlcGVuZGluZyBvbiB0aGUgdHlwZVxuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgXCJpbWFnZVwiOlxuICAgICAgICAgIHNlbGYuc2V0SW1hZ2Uoc2xpZGUpO1xuXG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBcImlmcmFtZVwiOlxuICAgICAgICAgIHNlbGYuc2V0SWZyYW1lKHNsaWRlKTtcblxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgXCJodG1sXCI6XG4gICAgICAgICAgc2VsZi5zZXRDb250ZW50KHNsaWRlLCBzbGlkZS5zcmMgfHwgc2xpZGUuY29udGVudCk7XG5cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIFwidmlkZW9cIjpcbiAgICAgICAgICBzZWxmLnNldENvbnRlbnQoXG4gICAgICAgICAgICBzbGlkZSxcbiAgICAgICAgICAgICc8dmlkZW8gY2xhc3M9XCJmYW5jeWJveC12aWRlb1wiIGNvbnRyb2xzIGNvbnRyb2xzTGlzdD1cIm5vZG93bmxvYWRcIj4nICtcbiAgICAgICAgICAgICAgJzxzb3VyY2Ugc3JjPVwiJyArXG4gICAgICAgICAgICAgIHNsaWRlLnNyYyArXG4gICAgICAgICAgICAgICdcIiB0eXBlPVwiJyArXG4gICAgICAgICAgICAgIHNsaWRlLm9wdHMudmlkZW9Gb3JtYXQgK1xuICAgICAgICAgICAgICAnXCI+JyArXG4gICAgICAgICAgICAgIFwiWW91ciBicm93c2VyIGRvZXNuJ3Qgc3VwcG9ydCBIVE1MNSB2aWRlb1wiICtcbiAgICAgICAgICAgICAgXCI8L3ZpZGVvXCJcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBcImlubGluZVwiOlxuICAgICAgICAgIGlmICgkKHNsaWRlLnNyYykubGVuZ3RoKSB7XG4gICAgICAgICAgICBzZWxmLnNldENvbnRlbnQoc2xpZGUsICQoc2xpZGUuc3JjKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc2V0RXJyb3Ioc2xpZGUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgXCJhamF4XCI6XG4gICAgICAgICAgc2VsZi5zaG93TG9hZGluZyhzbGlkZSk7XG5cbiAgICAgICAgICBhamF4TG9hZCA9ICQuYWpheChcbiAgICAgICAgICAgICQuZXh0ZW5kKHt9LCBzbGlkZS5vcHRzLmFqYXguc2V0dGluZ3MsIHtcbiAgICAgICAgICAgICAgdXJsOiBzbGlkZS5zcmMsXG4gICAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uKGRhdGEsIHRleHRTdGF0dXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodGV4dFN0YXR1cyA9PT0gXCJzdWNjZXNzXCIpIHtcbiAgICAgICAgICAgICAgICAgIHNlbGYuc2V0Q29udGVudChzbGlkZSwgZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBlcnJvcjogZnVuY3Rpb24oanFYSFIsIHRleHRTdGF0dXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoanFYSFIgJiYgdGV4dFN0YXR1cyAhPT0gXCJhYm9ydFwiKSB7XG4gICAgICAgICAgICAgICAgICBzZWxmLnNldEVycm9yKHNsaWRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKTtcblxuICAgICAgICAgICRzbGlkZS5vbmUoXCJvblJlc2V0XCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgYWpheExvYWQuYWJvcnQoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgc2VsZi5zZXRFcnJvcihzbGlkZSk7XG5cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIC8vIFVzZSB0aHVtYm5haWwgaW1hZ2UsIGlmIHBvc3NpYmxlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHNldEltYWdlOiBmdW5jdGlvbihzbGlkZSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBzcmNzZXQgPSBzbGlkZS5vcHRzLnNyY3NldCB8fCBzbGlkZS5vcHRzLmltYWdlLnNyY3NldCxcbiAgICAgICAgdGh1bWJTcmMsXG4gICAgICAgIGZvdW5kLFxuICAgICAgICB0ZW1wLFxuICAgICAgICBweFJhdGlvLFxuICAgICAgICB3aW5kb3dXaWR0aDtcblxuICAgICAgLy8gQ2hlY2sgaWYgbmVlZCB0byBzaG93IGxvYWRpbmcgaWNvblxuICAgICAgc2xpZGUudGltb3V0cyA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciAkaW1nID0gc2xpZGUuJGltYWdlO1xuXG4gICAgICAgIGlmIChzbGlkZS5pc0xvYWRpbmcgJiYgKCEkaW1nIHx8ICEkaW1nWzBdLmNvbXBsZXRlKSAmJiAhc2xpZGUuaGFzRXJyb3IpIHtcbiAgICAgICAgICBzZWxmLnNob3dMb2FkaW5nKHNsaWRlKTtcbiAgICAgICAgfVxuICAgICAgfSwgMzUwKTtcblxuICAgICAgLy8gSWYgd2UgaGF2ZSBcInNyY3NldFwiLCB0aGVuIHdlIG5lZWQgdG8gZmluZCBmaXJzdCBtYXRjaGluZyBcInNyY1wiIHZhbHVlLlxuICAgICAgLy8gVGhpcyBpcyBuZWNlc3NhcnksIGJlY2F1c2Ugd2hlbiB5b3Ugc2V0IGFuIHNyYyBhdHRyaWJ1dGUsIHRoZSBicm93c2VyIHdpbGwgcHJlbG9hZCB0aGUgaW1hZ2VcbiAgICAgIC8vIGJlZm9yZSBhbnkgamF2YXNjcmlwdCBvciBldmVuIENTUyBpcyBhcHBsaWVkLlxuICAgICAgaWYgKHNyY3NldCkge1xuICAgICAgICBweFJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW8gfHwgMTtcbiAgICAgICAgd2luZG93V2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aCAqIHB4UmF0aW87XG5cbiAgICAgICAgdGVtcCA9IHNyY3NldC5zcGxpdChcIixcIikubWFwKGZ1bmN0aW9uKGVsKSB7XG4gICAgICAgICAgdmFyIHJldCA9IHt9O1xuXG4gICAgICAgICAgZWxcbiAgICAgICAgICAgIC50cmltKClcbiAgICAgICAgICAgIC5zcGxpdCgvXFxzKy8pXG4gICAgICAgICAgICAuZm9yRWFjaChmdW5jdGlvbihlbCwgaSkge1xuICAgICAgICAgICAgICB2YXIgdmFsdWUgPSBwYXJzZUludChlbC5zdWJzdHJpbmcoMCwgZWwubGVuZ3RoIC0gMSksIDEwKTtcblxuICAgICAgICAgICAgICBpZiAoaSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAocmV0LnVybCA9IGVsKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHJldC52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHJldC5wb3N0Zml4ID0gZWxbZWwubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgcmV0dXJuIHJldDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU29ydCBieSB2YWx1ZVxuICAgICAgICB0ZW1wLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgIHJldHVybiBhLnZhbHVlIC0gYi52YWx1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gT2ssIG5vdyB3ZSBoYXZlIGFuIGFycmF5IG9mIGFsbCBzcmNzZXQgdmFsdWVzXG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdGVtcC5sZW5ndGg7IGorKykge1xuICAgICAgICAgIHZhciBlbCA9IHRlbXBbal07XG5cbiAgICAgICAgICBpZiAoKGVsLnBvc3RmaXggPT09IFwid1wiICYmIGVsLnZhbHVlID49IHdpbmRvd1dpZHRoKSB8fCAoZWwucG9zdGZpeCA9PT0gXCJ4XCIgJiYgZWwudmFsdWUgPj0gcHhSYXRpbykpIHtcbiAgICAgICAgICAgIGZvdW5kID0gZWw7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBub3QgZm91bmQsIHRha2UgdGhlIGxhc3Qgb25lXG4gICAgICAgIGlmICghZm91bmQgJiYgdGVtcC5sZW5ndGgpIHtcbiAgICAgICAgICBmb3VuZCA9IHRlbXBbdGVtcC5sZW5ndGggLSAxXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmb3VuZCkge1xuICAgICAgICAgIHNsaWRlLnNyYyA9IGZvdW5kLnVybDtcblxuICAgICAgICAgIC8vIElmIHdlIGhhdmUgZGVmYXVsdCB3aWR0aC9oZWlnaHQgdmFsdWVzLCB3ZSBjYW4gY2FsY3VsYXRlIGhlaWdodCBmb3IgbWF0Y2hpbmcgc291cmNlXG4gICAgICAgICAgaWYgKHNsaWRlLndpZHRoICYmIHNsaWRlLmhlaWdodCAmJiBmb3VuZC5wb3N0Zml4ID09IFwid1wiKSB7XG4gICAgICAgICAgICBzbGlkZS5oZWlnaHQgPSBzbGlkZS53aWR0aCAvIHNsaWRlLmhlaWdodCAqIGZvdW5kLnZhbHVlO1xuICAgICAgICAgICAgc2xpZGUud2lkdGggPSBmb3VuZC52YWx1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBzbGlkZS5vcHRzLnNyY3NldCA9IHNyY3NldDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBUaGlzIHdpbGwgYmUgd3JhcHBlciBjb250YWluaW5nIGJvdGggZ2hvc3QgYW5kIGFjdHVhbCBpbWFnZVxuICAgICAgc2xpZGUuJGNvbnRlbnQgPSAkKCc8ZGl2IGNsYXNzPVwiZmFuY3lib3gtY29udGVudFwiPjwvZGl2PicpXG4gICAgICAgIC5hZGRDbGFzcyhcImZhbmN5Ym94LWlzLWhpZGRlblwiKVxuICAgICAgICAuYXBwZW5kVG8oc2xpZGUuJHNsaWRlLmFkZENsYXNzKFwiZmFuY3lib3gtc2xpZGUtLWltYWdlXCIpKTtcblxuICAgICAgLy8gSWYgd2UgaGF2ZSBhIHRodW1ibmFpbCwgd2UgY2FuIGRpc3BsYXkgaXQgd2hpbGUgYWN0dWFsIGltYWdlIGlzIGxvYWRpbmdcbiAgICAgIC8vIFVzZXJzIHdpbGwgbm90IHN0YXJlIGF0IGJsYWNrIHNjcmVlbiBhbmQgYWN0dWFsIGltYWdlIHdpbGwgYXBwZWFyIGdyYWR1YWxseVxuICAgICAgdGh1bWJTcmMgPSBzbGlkZS5vcHRzLnRodW1iIHx8IChzbGlkZS5vcHRzLiR0aHVtYiAmJiBzbGlkZS5vcHRzLiR0aHVtYi5sZW5ndGggPyBzbGlkZS5vcHRzLiR0aHVtYi5hdHRyKFwic3JjXCIpIDogZmFsc2UpO1xuXG4gICAgICBpZiAoc2xpZGUub3B0cy5wcmVsb2FkICE9PSBmYWxzZSAmJiBzbGlkZS5vcHRzLndpZHRoICYmIHNsaWRlLm9wdHMuaGVpZ2h0ICYmIHRodW1iU3JjKSB7XG4gICAgICAgIHNsaWRlLndpZHRoID0gc2xpZGUub3B0cy53aWR0aDtcbiAgICAgICAgc2xpZGUuaGVpZ2h0ID0gc2xpZGUub3B0cy5oZWlnaHQ7XG5cbiAgICAgICAgc2xpZGUuJGdob3N0ID0gJChcIjxpbWcgLz5cIilcbiAgICAgICAgICAub25lKFwiZXJyb3JcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAkKHRoaXMpLnJlbW92ZSgpO1xuXG4gICAgICAgICAgICBzbGlkZS4kZ2hvc3QgPSBudWxsO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLm9uZShcImxvYWRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLmFmdGVyTG9hZChzbGlkZSk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuYWRkQ2xhc3MoXCJmYW5jeWJveC1pbWFnZVwiKVxuICAgICAgICAgIC5hcHBlbmRUbyhzbGlkZS4kY29udGVudClcbiAgICAgICAgICAuYXR0cihcInNyY1wiLCB0aHVtYlNyYyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFN0YXJ0IGxvYWRpbmcgYWN0dWFsIGltYWdlXG4gICAgICBzZWxmLnNldEJpZ0ltYWdlKHNsaWRlKTtcbiAgICB9LFxuXG4gICAgLy8gQ3JlYXRlIGZ1bGwtc2l6ZSBpbWFnZVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHNldEJpZ0ltYWdlOiBmdW5jdGlvbihzbGlkZSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAkaW1nID0gJChcIjxpbWcgLz5cIik7XG5cbiAgICAgIHNsaWRlLiRpbWFnZSA9ICRpbWdcbiAgICAgICAgLm9uZShcImVycm9yXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHNlbGYuc2V0RXJyb3Ioc2xpZGUpO1xuICAgICAgICB9KVxuICAgICAgICAub25lKFwibG9hZFwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgc2l6ZXM7XG5cbiAgICAgICAgICBpZiAoIXNsaWRlLiRnaG9zdCkge1xuICAgICAgICAgICAgc2VsZi5yZXNvbHZlSW1hZ2VTbGlkZVNpemUoc2xpZGUsIHRoaXMubmF0dXJhbFdpZHRoLCB0aGlzLm5hdHVyYWxIZWlnaHQpO1xuXG4gICAgICAgICAgICBzZWxmLmFmdGVyTG9hZChzbGlkZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gQ2xlYXIgdGltZW91dCB0aGF0IGNoZWNrcyBpZiBsb2FkaW5nIGljb24gbmVlZHMgdG8gYmUgZGlzcGxheWVkXG4gICAgICAgICAgaWYgKHNsaWRlLnRpbW91dHMpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChzbGlkZS50aW1vdXRzKTtcbiAgICAgICAgICAgIHNsaWRlLnRpbW91dHMgPSBudWxsO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzZWxmLmlzQ2xvc2luZykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzbGlkZS5vcHRzLnNyY3NldCkge1xuICAgICAgICAgICAgc2l6ZXMgPSBzbGlkZS5vcHRzLnNpemVzO1xuXG4gICAgICAgICAgICBpZiAoIXNpemVzIHx8IHNpemVzID09PSBcImF1dG9cIikge1xuICAgICAgICAgICAgICBzaXplcyA9XG4gICAgICAgICAgICAgICAgKHNsaWRlLndpZHRoIC8gc2xpZGUuaGVpZ2h0ID4gMSAmJiAkVy53aWR0aCgpIC8gJFcuaGVpZ2h0KCkgPiAxID8gXCIxMDBcIiA6IE1hdGgucm91bmQoc2xpZGUud2lkdGggLyBzbGlkZS5oZWlnaHQgKiAxMDApKSArXG4gICAgICAgICAgICAgICAgXCJ2d1wiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAkaW1nLmF0dHIoXCJzaXplc1wiLCBzaXplcykuYXR0cihcInNyY3NldFwiLCBzbGlkZS5vcHRzLnNyY3NldCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gSGlkZSB0ZW1wb3JhcnkgaW1hZ2UgYWZ0ZXIgc29tZSBkZWxheVxuICAgICAgICAgIGlmIChzbGlkZS4kZ2hvc3QpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgIGlmIChzbGlkZS4kZ2hvc3QgJiYgIXNlbGYuaXNDbG9zaW5nKSB7XG4gICAgICAgICAgICAgICAgc2xpZGUuJGdob3N0LmhpZGUoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgTWF0aC5taW4oMzAwLCBNYXRoLm1heCgxMDAwLCBzbGlkZS5oZWlnaHQgLyAxNjAwKSkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNlbGYuaGlkZUxvYWRpbmcoc2xpZGUpO1xuICAgICAgICB9KVxuICAgICAgICAuYWRkQ2xhc3MoXCJmYW5jeWJveC1pbWFnZVwiKVxuICAgICAgICAuYXR0cihcInNyY1wiLCBzbGlkZS5zcmMpXG4gICAgICAgIC5hcHBlbmRUbyhzbGlkZS4kY29udGVudCk7XG5cbiAgICAgIGlmICgoJGltZ1swXS5jb21wbGV0ZSB8fCAkaW1nWzBdLnJlYWR5U3RhdGUgPT0gXCJjb21wbGV0ZVwiKSAmJiAkaW1nWzBdLm5hdHVyYWxXaWR0aCAmJiAkaW1nWzBdLm5hdHVyYWxIZWlnaHQpIHtcbiAgICAgICAgJGltZy50cmlnZ2VyKFwibG9hZFwiKTtcbiAgICAgIH0gZWxzZSBpZiAoJGltZ1swXS5lcnJvcikge1xuICAgICAgICAkaW1nLnRyaWdnZXIoXCJlcnJvclwiKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gQ29tcHV0ZXMgdGhlIHNsaWRlIHNpemUgZnJvbSBpbWFnZSBzaXplIGFuZCBtYXhXaWR0aC9tYXhIZWlnaHRcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgcmVzb2x2ZUltYWdlU2xpZGVTaXplOiBmdW5jdGlvbihzbGlkZSwgaW1nV2lkdGgsIGltZ0hlaWdodCkge1xuICAgICAgdmFyIG1heFdpZHRoID0gcGFyc2VJbnQoc2xpZGUub3B0cy53aWR0aCwgMTApLFxuICAgICAgICBtYXhIZWlnaHQgPSBwYXJzZUludChzbGlkZS5vcHRzLmhlaWdodCwgMTApO1xuXG4gICAgICAvLyBTZXRzIHRoZSBkZWZhdWx0IHZhbHVlcyBmcm9tIHRoZSBpbWFnZVxuICAgICAgc2xpZGUud2lkdGggPSBpbWdXaWR0aDtcbiAgICAgIHNsaWRlLmhlaWdodCA9IGltZ0hlaWdodDtcblxuICAgICAgaWYgKG1heFdpZHRoID4gMCkge1xuICAgICAgICBzbGlkZS53aWR0aCA9IG1heFdpZHRoO1xuICAgICAgICBzbGlkZS5oZWlnaHQgPSBNYXRoLmZsb29yKG1heFdpZHRoICogaW1nSGVpZ2h0IC8gaW1nV2lkdGgpO1xuICAgICAgfVxuXG4gICAgICBpZiAobWF4SGVpZ2h0ID4gMCkge1xuICAgICAgICBzbGlkZS53aWR0aCA9IE1hdGguZmxvb3IobWF4SGVpZ2h0ICogaW1nV2lkdGggLyBpbWdIZWlnaHQpO1xuICAgICAgICBzbGlkZS5oZWlnaHQgPSBtYXhIZWlnaHQ7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIENyZWF0ZSBpZnJhbWUgd3JhcHBlciwgaWZyYW1lIGFuZCBiaW5kaW5nc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgc2V0SWZyYW1lOiBmdW5jdGlvbihzbGlkZSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBvcHRzID0gc2xpZGUub3B0cy5pZnJhbWUsXG4gICAgICAgICRzbGlkZSA9IHNsaWRlLiRzbGlkZSxcbiAgICAgICAgJGlmcmFtZTtcblxuICAgICAgc2xpZGUuJGNvbnRlbnQgPSAkKCc8ZGl2IGNsYXNzPVwiZmFuY3lib3gtY29udGVudCcgKyAob3B0cy5wcmVsb2FkID8gXCIgZmFuY3lib3gtaXMtaGlkZGVuXCIgOiBcIlwiKSArICdcIj48L2Rpdj4nKVxuICAgICAgICAuY3NzKG9wdHMuY3NzKVxuICAgICAgICAuYXBwZW5kVG8oJHNsaWRlKTtcblxuICAgICAgJHNsaWRlLmFkZENsYXNzKFwiZmFuY3lib3gtc2xpZGUtLVwiICsgc2xpZGUuY29udGVudFR5cGUpO1xuXG4gICAgICBzbGlkZS4kaWZyYW1lID0gJGlmcmFtZSA9ICQob3B0cy50cGwucmVwbGFjZSgvXFx7cm5kXFx9L2csIG5ldyBEYXRlKCkuZ2V0VGltZSgpKSlcbiAgICAgICAgLmF0dHIob3B0cy5hdHRyKVxuICAgICAgICAuYXBwZW5kVG8oc2xpZGUuJGNvbnRlbnQpO1xuXG4gICAgICBpZiAob3B0cy5wcmVsb2FkKSB7XG4gICAgICAgIHNlbGYuc2hvd0xvYWRpbmcoc2xpZGUpO1xuXG4gICAgICAgIC8vIFVuZm9ydHVuYXRlbHksIGl0IGlzIG5vdCBhbHdheXMgcG9zc2libGUgdG8gZGV0ZXJtaW5lIGlmIGlmcmFtZSBpcyBzdWNjZXNzZnVsbHkgbG9hZGVkXG4gICAgICAgIC8vIChkdWUgdG8gYnJvd3NlciBzZWN1cml0eSBwb2xpY3kpXG5cbiAgICAgICAgJGlmcmFtZS5vbihcImxvYWQuZmIgZXJyb3IuZmJcIiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgIHRoaXMuaXNSZWFkeSA9IDE7XG5cbiAgICAgICAgICBzbGlkZS4kc2xpZGUudHJpZ2dlcihcInJlZnJlc2hcIik7XG5cbiAgICAgICAgICBzZWxmLmFmdGVyTG9hZChzbGlkZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFJlY2FsY3VsYXRlIGlmcmFtZSBjb250ZW50IHNpemVcbiAgICAgICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgICAgICRzbGlkZS5vbihcInJlZnJlc2guZmJcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgdmFyICRjb250ZW50ID0gc2xpZGUuJGNvbnRlbnQsXG4gICAgICAgICAgICBmcmFtZVdpZHRoID0gb3B0cy5jc3Mud2lkdGgsXG4gICAgICAgICAgICBmcmFtZUhlaWdodCA9IG9wdHMuY3NzLmhlaWdodCxcbiAgICAgICAgICAgICRjb250ZW50cyxcbiAgICAgICAgICAgICRib2R5O1xuXG4gICAgICAgICAgaWYgKCRpZnJhbWVbMF0uaXNSZWFkeSAhPT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAkY29udGVudHMgPSAkaWZyYW1lLmNvbnRlbnRzKCk7XG4gICAgICAgICAgICAkYm9keSA9ICRjb250ZW50cy5maW5kKFwiYm9keVwiKTtcbiAgICAgICAgICB9IGNhdGNoIChpZ25vcmUpIHt9XG5cbiAgICAgICAgICAvLyBDYWxjdWxhdGUgY29udG5ldCBkaW1lbnNpb25zIGlmIGl0IGlzIGFjY2Vzc2libGVcbiAgICAgICAgICBpZiAoJGJvZHkgJiYgJGJvZHkubGVuZ3RoICYmICRib2R5LmNoaWxkcmVuKCkubGVuZ3RoKSB7XG4gICAgICAgICAgICAkY29udGVudC5jc3Moe1xuICAgICAgICAgICAgICB3aWR0aDogXCJcIixcbiAgICAgICAgICAgICAgaGVpZ2h0OiBcIlwiXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKGZyYW1lV2lkdGggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBmcmFtZVdpZHRoID0gTWF0aC5jZWlsKE1hdGgubWF4KCRib2R5WzBdLmNsaWVudFdpZHRoLCAkYm9keS5vdXRlcldpZHRoKHRydWUpKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmcmFtZVdpZHRoKSB7XG4gICAgICAgICAgICAgICRjb250ZW50LndpZHRoKGZyYW1lV2lkdGgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZnJhbWVIZWlnaHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBmcmFtZUhlaWdodCA9IE1hdGguY2VpbChNYXRoLm1heCgkYm9keVswXS5jbGllbnRIZWlnaHQsICRib2R5Lm91dGVySGVpZ2h0KHRydWUpKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmcmFtZUhlaWdodCkge1xuICAgICAgICAgICAgICAkY29udGVudC5oZWlnaHQoZnJhbWVIZWlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgICRjb250ZW50LnJlbW92ZUNsYXNzKFwiZmFuY3lib3gtaXMtaGlkZGVuXCIpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYWZ0ZXJMb2FkKHNsaWRlKTtcbiAgICAgIH1cblxuICAgICAgJGlmcmFtZS5hdHRyKFwic3JjXCIsIHNsaWRlLnNyYyk7XG5cbiAgICAgIC8vIFJlbW92ZSBpZnJhbWUgaWYgY2xvc2luZyBvciBjaGFuZ2luZyBnYWxsZXJ5IGl0ZW1cbiAgICAgICRzbGlkZS5vbmUoXCJvblJlc2V0XCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBUaGlzIGhlbHBzIElFIG5vdCB0byB0aHJvdyBlcnJvcnMgd2hlbiBjbG9zaW5nXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgJCh0aGlzKVxuICAgICAgICAgICAgLmZpbmQoXCJpZnJhbWVcIilcbiAgICAgICAgICAgIC5oaWRlKClcbiAgICAgICAgICAgIC51bmJpbmQoKVxuICAgICAgICAgICAgLmF0dHIoXCJzcmNcIiwgXCIvL2Fib3V0OmJsYW5rXCIpO1xuICAgICAgICB9IGNhdGNoIChpZ25vcmUpIHt9XG5cbiAgICAgICAgJCh0aGlzKVxuICAgICAgICAgIC5vZmYoXCJyZWZyZXNoLmZiXCIpXG4gICAgICAgICAgLmVtcHR5KCk7XG5cbiAgICAgICAgc2xpZGUuaXNMb2FkZWQgPSBmYWxzZTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvLyBXcmFwIGFuZCBhcHBlbmQgY29udGVudCB0byB0aGUgc2xpZGVcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgc2V0Q29udGVudDogZnVuY3Rpb24oc2xpZGUsIGNvbnRlbnQpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgaWYgKHNlbGYuaXNDbG9zaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgc2VsZi5oaWRlTG9hZGluZyhzbGlkZSk7XG5cbiAgICAgIGlmIChzbGlkZS4kY29udGVudCkge1xuICAgICAgICAkLmZhbmN5Ym94LnN0b3Aoc2xpZGUuJGNvbnRlbnQpO1xuICAgICAgfVxuXG4gICAgICBzbGlkZS4kc2xpZGUuZW1wdHkoKTtcblxuICAgICAgLy8gSWYgY29udGVudCBpcyBhIGpRdWVyeSBvYmplY3QsIHRoZW4gaXQgd2lsbCBiZSBtb3ZlZCB0byB0aGUgc2xpZGUuXG4gICAgICAvLyBUaGUgcGxhY2Vob2xkZXIgaXMgY3JlYXRlZCBzbyB3ZSB3aWxsIGtub3cgd2hlcmUgdG8gcHV0IGl0IGJhY2suXG4gICAgICBpZiAoaXNRdWVyeShjb250ZW50KSAmJiBjb250ZW50LnBhcmVudCgpLmxlbmd0aCkge1xuICAgICAgICAvLyBNYWtlIHN1cmUgY29udGVudCBpcyBub3QgYWxyZWFkeSBtb3ZlZCB0byBmYW5jeUJveFxuICAgICAgICBjb250ZW50XG4gICAgICAgICAgLnBhcmVudCgpXG4gICAgICAgICAgLnBhcmVudChcIi5mYW5jeWJveC1zbGlkZS0taW5saW5lXCIpXG4gICAgICAgICAgLnRyaWdnZXIoXCJvblJlc2V0XCIpO1xuXG4gICAgICAgIC8vIENyZWF0ZSB0ZW1wb3JhcnkgZWxlbWVudCBtYXJraW5nIG9yaWdpbmFsIHBsYWNlIG9mIHRoZSBjb250ZW50XG4gICAgICAgIHNsaWRlLiRwbGFjZWhvbGRlciA9ICQoXCI8ZGl2PlwiKVxuICAgICAgICAgIC5oaWRlKClcbiAgICAgICAgICAuaW5zZXJ0QWZ0ZXIoY29udGVudCk7XG5cbiAgICAgICAgLy8gTWFrZSBzdXJlIGNvbnRlbnQgaXMgdmlzaWJsZVxuICAgICAgICBjb250ZW50LmNzcyhcImRpc3BsYXlcIiwgXCJpbmxpbmUtYmxvY2tcIik7XG4gICAgICB9IGVsc2UgaWYgKCFzbGlkZS5oYXNFcnJvcikge1xuICAgICAgICAvLyBJZiBjb250ZW50IGlzIGp1c3QgYSBwbGFpbiB0ZXh0LCB0cnkgdG8gY29udmVydCBpdCB0byBodG1sXG4gICAgICAgIGlmICgkLnR5cGUoY29udGVudCkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICBjb250ZW50ID0gJChcIjxkaXY+XCIpXG4gICAgICAgICAgICAuYXBwZW5kKCQudHJpbShjb250ZW50KSlcbiAgICAgICAgICAgIC5jb250ZW50cygpO1xuXG4gICAgICAgICAgLy8gSWYgd2UgaGF2ZSB0ZXh0IG5vZGUsIHRoZW4gYWRkIHdyYXBwaW5nIGVsZW1lbnQgdG8gbWFrZSB2ZXJ0aWNhbCBhbGlnbm1lbnQgd29ya1xuICAgICAgICAgIGlmIChjb250ZW50WzBdLm5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgICAgICBjb250ZW50ID0gJChcIjxkaXY+XCIpLmh0bWwoY29udGVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgXCJmaWx0ZXJcIiBvcHRpb24gaXMgcHJvdmlkZWQsIHRoZW4gZmlsdGVyIGNvbnRlbnRcbiAgICAgICAgaWYgKHNsaWRlLm9wdHMuZmlsdGVyKSB7XG4gICAgICAgICAgY29udGVudCA9ICQoXCI8ZGl2PlwiKVxuICAgICAgICAgICAgLmh0bWwoY29udGVudClcbiAgICAgICAgICAgIC5maW5kKHNsaWRlLm9wdHMuZmlsdGVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzbGlkZS4kc2xpZGUub25lKFwib25SZXNldFwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gUGF1c2UgYWxsIGh0bWw1IHZpZGVvL2F1ZGlvXG4gICAgICAgICQodGhpcylcbiAgICAgICAgICAuZmluZChcInZpZGVvLGF1ZGlvXCIpXG4gICAgICAgICAgLnRyaWdnZXIoXCJwYXVzZVwiKTtcblxuICAgICAgICAvLyBQdXQgY29udGVudCBiYWNrXG4gICAgICAgIGlmIChzbGlkZS4kcGxhY2Vob2xkZXIpIHtcbiAgICAgICAgICBzbGlkZS4kcGxhY2Vob2xkZXIuYWZ0ZXIoY29udGVudC5oaWRlKCkpLnJlbW92ZSgpO1xuXG4gICAgICAgICAgc2xpZGUuJHBsYWNlaG9sZGVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSBjdXN0b20gY2xvc2UgYnV0dG9uXG4gICAgICAgIGlmIChzbGlkZS4kc21hbGxCdG4pIHtcbiAgICAgICAgICBzbGlkZS4kc21hbGxCdG4ucmVtb3ZlKCk7XG5cbiAgICAgICAgICBzbGlkZS4kc21hbGxCdG4gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIGNvbnRlbnQgYW5kIG1hcmsgc2xpZGUgYXMgbm90IGxvYWRlZFxuICAgICAgICBpZiAoIXNsaWRlLmhhc0Vycm9yKSB7XG4gICAgICAgICAgJCh0aGlzKS5lbXB0eSgpO1xuXG4gICAgICAgICAgc2xpZGUuaXNMb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgICQoY29udGVudCkuYXBwZW5kVG8oc2xpZGUuJHNsaWRlKTtcblxuICAgICAgaWYgKCQoY29udGVudCkuaXMoXCJ2aWRlbyxhdWRpb1wiKSkge1xuICAgICAgICAkKGNvbnRlbnQpLmFkZENsYXNzKFwiZmFuY3lib3gtdmlkZW9cIik7XG5cbiAgICAgICAgJChjb250ZW50KS53cmFwKFwiPGRpdj48L2Rpdj5cIik7XG5cbiAgICAgICAgc2xpZGUuY29udGVudFR5cGUgPSBcInZpZGVvXCI7XG5cbiAgICAgICAgc2xpZGUub3B0cy53aWR0aCA9IHNsaWRlLm9wdHMud2lkdGggfHwgJChjb250ZW50KS5hdHRyKFwid2lkdGhcIik7XG4gICAgICAgIHNsaWRlLm9wdHMuaGVpZ2h0ID0gc2xpZGUub3B0cy5oZWlnaHQgfHwgJChjb250ZW50KS5hdHRyKFwiaGVpZ2h0XCIpO1xuICAgICAgfVxuXG4gICAgICBzbGlkZS4kY29udGVudCA9IHNsaWRlLiRzbGlkZVxuICAgICAgICAuY2hpbGRyZW4oKVxuICAgICAgICAuZmlsdGVyKFwiZGl2LGZvcm0sbWFpbix2aWRlbyxhdWRpb1wiKVxuICAgICAgICAuZmlyc3QoKVxuICAgICAgICAuYWRkQ2xhc3MoXCJmYW5jeWJveC1jb250ZW50XCIpO1xuXG4gICAgICBzbGlkZS4kc2xpZGUuYWRkQ2xhc3MoXCJmYW5jeWJveC1zbGlkZS0tXCIgKyBzbGlkZS5jb250ZW50VHlwZSk7XG5cbiAgICAgIHRoaXMuYWZ0ZXJMb2FkKHNsaWRlKTtcbiAgICB9LFxuXG4gICAgLy8gRGlzcGxheSBlcnJvciBtZXNzYWdlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBzZXRFcnJvcjogZnVuY3Rpb24oc2xpZGUpIHtcbiAgICAgIHNsaWRlLmhhc0Vycm9yID0gdHJ1ZTtcblxuICAgICAgc2xpZGUuJHNsaWRlXG4gICAgICAgIC50cmlnZ2VyKFwib25SZXNldFwiKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoXCJmYW5jeWJveC1zbGlkZS0tXCIgKyBzbGlkZS5jb250ZW50VHlwZSlcbiAgICAgICAgLmFkZENsYXNzKFwiZmFuY3lib3gtc2xpZGUtLWVycm9yXCIpO1xuXG4gICAgICBzbGlkZS5jb250ZW50VHlwZSA9IFwiaHRtbFwiO1xuXG4gICAgICB0aGlzLnNldENvbnRlbnQoc2xpZGUsIHRoaXMudHJhbnNsYXRlKHNsaWRlLCBzbGlkZS5vcHRzLmVycm9yVHBsKSk7XG5cbiAgICAgIGlmIChzbGlkZS5wb3MgPT09IHRoaXMuY3VyclBvcykge1xuICAgICAgICB0aGlzLmlzQW5pbWF0aW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIFNob3cgbG9hZGluZyBpY29uIGluc2lkZSB0aGUgc2xpZGVcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBzaG93TG9hZGluZzogZnVuY3Rpb24oc2xpZGUpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgc2xpZGUgPSBzbGlkZSB8fCBzZWxmLmN1cnJlbnQ7XG5cbiAgICAgIGlmIChzbGlkZSAmJiAhc2xpZGUuJHNwaW5uZXIpIHtcbiAgICAgICAgc2xpZGUuJHNwaW5uZXIgPSAkKHNlbGYudHJhbnNsYXRlKHNlbGYsIHNlbGYub3B0cy5zcGlubmVyVHBsKSkuYXBwZW5kVG8oc2xpZGUuJHNsaWRlKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gUmVtb3ZlIGxvYWRpbmcgaWNvbiBmcm9tIHRoZSBzbGlkZVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGhpZGVMb2FkaW5nOiBmdW5jdGlvbihzbGlkZSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICBzbGlkZSA9IHNsaWRlIHx8IHNlbGYuY3VycmVudDtcblxuICAgICAgaWYgKHNsaWRlICYmIHNsaWRlLiRzcGlubmVyKSB7XG4gICAgICAgIHNsaWRlLiRzcGlubmVyLnJlbW92ZSgpO1xuXG4gICAgICAgIGRlbGV0ZSBzbGlkZS4kc3Bpbm5lcjtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gQWRqdXN0bWVudHMgYWZ0ZXIgc2xpZGUgY29udGVudCBoYXMgYmVlbiBsb2FkZWRcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgYWZ0ZXJMb2FkOiBmdW5jdGlvbihzbGlkZSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICBpZiAoc2VsZi5pc0Nsb3NpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBzbGlkZS5pc0xvYWRpbmcgPSBmYWxzZTtcbiAgICAgIHNsaWRlLmlzTG9hZGVkID0gdHJ1ZTtcblxuICAgICAgc2VsZi50cmlnZ2VyKFwiYWZ0ZXJMb2FkXCIsIHNsaWRlKTtcblxuICAgICAgc2VsZi5oaWRlTG9hZGluZyhzbGlkZSk7XG5cbiAgICAgIGlmIChzbGlkZS5wb3MgPT09IHNlbGYuY3VyclBvcykge1xuICAgICAgICBzZWxmLnVwZGF0ZUN1cnNvcigpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2xpZGUub3B0cy5zbWFsbEJ0biAmJiAoIXNsaWRlLiRzbWFsbEJ0biB8fCAhc2xpZGUuJHNtYWxsQnRuLmxlbmd0aCkpIHtcbiAgICAgICAgc2xpZGUuJHNtYWxsQnRuID0gJChzZWxmLnRyYW5zbGF0ZShzbGlkZSwgc2xpZGUub3B0cy5idG5UcGwuc21hbGxCdG4pKS5wcmVwZW5kVG8oc2xpZGUuJGNvbnRlbnQpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2xpZGUub3B0cy5wcm90ZWN0ICYmIHNsaWRlLiRjb250ZW50ICYmICFzbGlkZS5oYXNFcnJvcikge1xuICAgICAgICAvLyBEaXNhYmxlIHJpZ2h0IGNsaWNrXG4gICAgICAgIHNsaWRlLiRjb250ZW50Lm9uKFwiY29udGV4dG1lbnUuZmJcIiwgZnVuY3Rpb24oZSkge1xuICAgICAgICAgIGlmIChlLmJ1dHRvbiA9PSAyKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBmYWtlIGVsZW1lbnQgb24gdG9wIG9mIHRoZSBpbWFnZVxuICAgICAgICAvLyBUaGlzIG1ha2VzIGEgYml0IGhhcmRlciBmb3IgdXNlciB0byBzZWxlY3QgaW1hZ2VcbiAgICAgICAgaWYgKHNsaWRlLnR5cGUgPT09IFwiaW1hZ2VcIikge1xuICAgICAgICAgICQoJzxkaXYgY2xhc3M9XCJmYW5jeWJveC1zcGFjZWJhbGxcIj48L2Rpdj4nKS5hcHBlbmRUbyhzbGlkZS4kY29udGVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgc2VsZi5yZXZlYWxDb250ZW50KHNsaWRlKTtcbiAgICB9LFxuXG4gICAgLy8gTWFrZSBjb250ZW50IHZpc2libGVcbiAgICAvLyBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgcmlnaHQgYWZ0ZXIgY29udGVudCBoYXMgYmVlbiBsb2FkZWQgb3JcbiAgICAvLyB1c2VyIG5hdmlnYXRlcyBnYWxsZXJ5IGFuZCB0cmFuc2l0aW9uIHNob3VsZCBzdGFydFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgcmV2ZWFsQ29udGVudDogZnVuY3Rpb24oc2xpZGUpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgJHNsaWRlID0gc2xpZGUuJHNsaWRlLFxuICAgICAgICBlbmQgPSBmYWxzZSxcbiAgICAgICAgc3RhcnQgPSBmYWxzZSxcbiAgICAgICAgZWZmZWN0LFxuICAgICAgICBlZmZlY3RDbGFzc05hbWUsXG4gICAgICAgIGR1cmF0aW9uLFxuICAgICAgICBvcGFjaXR5O1xuXG4gICAgICBlZmZlY3QgPSBzbGlkZS5vcHRzW3NlbGYuZmlyc3RSdW4gPyBcImFuaW1hdGlvbkVmZmVjdFwiIDogXCJ0cmFuc2l0aW9uRWZmZWN0XCJdO1xuICAgICAgZHVyYXRpb24gPSBzbGlkZS5vcHRzW3NlbGYuZmlyc3RSdW4gPyBcImFuaW1hdGlvbkR1cmF0aW9uXCIgOiBcInRyYW5zaXRpb25EdXJhdGlvblwiXTtcblxuICAgICAgZHVyYXRpb24gPSBwYXJzZUludChzbGlkZS5mb3JjZWREdXJhdGlvbiA9PT0gdW5kZWZpbmVkID8gZHVyYXRpb24gOiBzbGlkZS5mb3JjZWREdXJhdGlvbiwgMTApO1xuXG4gICAgICAvLyBEbyBub3QgYW5pbWF0ZSBpZiByZXZlYWxpbmcgdGhlIHNhbWUgc2xpZGVcbiAgICAgIGlmIChzbGlkZS5wb3MgPT09IHNlbGYuY3VyclBvcykge1xuICAgICAgICBpZiAoc2xpZGUuaXNDb21wbGV0ZSkge1xuICAgICAgICAgIGVmZmVjdCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlbGYuaXNBbmltYXRpbmcgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzbGlkZS5pc01vdmVkIHx8IHNsaWRlLnBvcyAhPT0gc2VsZi5jdXJyUG9zIHx8ICFkdXJhdGlvbikge1xuICAgICAgICBlZmZlY3QgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgY2FuIHpvb21cbiAgICAgIGlmIChlZmZlY3QgPT09IFwiem9vbVwiKSB7XG4gICAgICAgIGlmIChzbGlkZS5wb3MgPT09IHNlbGYuY3VyclBvcyAmJiBkdXJhdGlvbiAmJiBzbGlkZS50eXBlID09PSBcImltYWdlXCIgJiYgIXNsaWRlLmhhc0Vycm9yICYmIChzdGFydCA9IHNlbGYuZ2V0VGh1bWJQb3Moc2xpZGUpKSkge1xuICAgICAgICAgIGVuZCA9IHNlbGYuZ2V0Rml0UG9zKHNsaWRlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlZmZlY3QgPSBcImZhZGVcIjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBab29tIGFuaW1hdGlvblxuICAgICAgLy8gPT09PT09PT09PT09PT1cbiAgICAgIGlmIChlZmZlY3QgPT09IFwiem9vbVwiKSB7XG4gICAgICAgIGVuZC5zY2FsZVggPSBlbmQud2lkdGggLyBzdGFydC53aWR0aDtcbiAgICAgICAgZW5kLnNjYWxlWSA9IGVuZC5oZWlnaHQgLyBzdGFydC5oZWlnaHQ7XG5cbiAgICAgICAgLy8gQ2hlY2sgaWYgd2UgbmVlZCB0byBhbmltYXRlIG9wYWNpdHlcbiAgICAgICAgb3BhY2l0eSA9IHNsaWRlLm9wdHMuem9vbU9wYWNpdHk7XG5cbiAgICAgICAgaWYgKG9wYWNpdHkgPT0gXCJhdXRvXCIpIHtcbiAgICAgICAgICBvcGFjaXR5ID0gTWF0aC5hYnMoc2xpZGUud2lkdGggLyBzbGlkZS5oZWlnaHQgLSBzdGFydC53aWR0aCAvIHN0YXJ0LmhlaWdodCkgPiAwLjE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3BhY2l0eSkge1xuICAgICAgICAgIHN0YXJ0Lm9wYWNpdHkgPSAwLjE7XG4gICAgICAgICAgZW5kLm9wYWNpdHkgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRHJhdyBpbWFnZSBhdCBzdGFydCBwb3NpdGlvblxuICAgICAgICAkLmZhbmN5Ym94LnNldFRyYW5zbGF0ZShzbGlkZS4kY29udGVudC5yZW1vdmVDbGFzcyhcImZhbmN5Ym94LWlzLWhpZGRlblwiKSwgc3RhcnQpO1xuXG4gICAgICAgIGZvcmNlUmVkcmF3KHNsaWRlLiRjb250ZW50KTtcblxuICAgICAgICAvLyBTdGFydCBhbmltYXRpb25cbiAgICAgICAgJC5mYW5jeWJveC5hbmltYXRlKHNsaWRlLiRjb250ZW50LCBlbmQsIGR1cmF0aW9uLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBzZWxmLmlzQW5pbWF0aW5nID0gZmFsc2U7XG5cbiAgICAgICAgICBzZWxmLmNvbXBsZXRlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgc2VsZi51cGRhdGVTbGlkZShzbGlkZSk7XG5cbiAgICAgIC8vIFNpbXBseSBzaG93IGNvbnRlbnRcbiAgICAgIC8vID09PT09PT09PT09PT09PT09PT1cblxuICAgICAgaWYgKCFlZmZlY3QpIHtcbiAgICAgICAgZm9yY2VSZWRyYXcoJHNsaWRlKTtcblxuICAgICAgICBzbGlkZS4kY29udGVudC5yZW1vdmVDbGFzcyhcImZhbmN5Ym94LWlzLWhpZGRlblwiKTtcblxuICAgICAgICBpZiAoc2xpZGUucG9zID09PSBzZWxmLmN1cnJQb3MpIHtcbiAgICAgICAgICBzZWxmLmNvbXBsZXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgICQuZmFuY3lib3guc3RvcCgkc2xpZGUpO1xuXG4gICAgICBlZmZlY3RDbGFzc05hbWUgPSBcImZhbmN5Ym94LWFuaW1hdGVkIGZhbmN5Ym94LXNsaWRlLS1cIiArIChzbGlkZS5wb3MgPj0gc2VsZi5wcmV2UG9zID8gXCJuZXh0XCIgOiBcInByZXZpb3VzXCIpICsgXCIgZmFuY3lib3gtZngtXCIgKyBlZmZlY3Q7XG5cbiAgICAgICRzbGlkZVxuICAgICAgICAucmVtb3ZlQXR0cihcInN0eWxlXCIpXG4gICAgICAgIC5yZW1vdmVDbGFzcyhcImZhbmN5Ym94LXNsaWRlLS1jdXJyZW50IGZhbmN5Ym94LXNsaWRlLS1uZXh0IGZhbmN5Ym94LXNsaWRlLS1wcmV2aW91c1wiKVxuICAgICAgICAuYWRkQ2xhc3MoZWZmZWN0Q2xhc3NOYW1lKTtcblxuICAgICAgc2xpZGUuJGNvbnRlbnQucmVtb3ZlQ2xhc3MoXCJmYW5jeWJveC1pcy1oaWRkZW5cIik7XG5cbiAgICAgIC8vIEZvcmNlIHJlZmxvdyBmb3IgQ1NTMyB0cmFuc2l0aW9uc1xuICAgICAgZm9yY2VSZWRyYXcoJHNsaWRlKTtcblxuICAgICAgJC5mYW5jeWJveC5hbmltYXRlKFxuICAgICAgICAkc2xpZGUsXG4gICAgICAgIFwiZmFuY3lib3gtc2xpZGUtLWN1cnJlbnRcIixcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAkc2xpZGUucmVtb3ZlQ2xhc3MoZWZmZWN0Q2xhc3NOYW1lKS5yZW1vdmVBdHRyKFwic3R5bGVcIik7XG5cbiAgICAgICAgICBpZiAoc2xpZGUucG9zID09PSBzZWxmLmN1cnJQb3MpIHtcbiAgICAgICAgICAgIHNlbGYuY29tcGxldGUoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHRydWVcbiAgICAgICk7XG4gICAgfSxcblxuICAgIC8vIENoZWNrIGlmIHdlIGNhbiBhbmQgaGF2ZSB0byB6b29tIGZyb20gdGh1bWJuYWlsXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGdldFRodW1iUG9zOiBmdW5jdGlvbihzbGlkZSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICByZXogPSBmYWxzZSxcbiAgICAgICAgJHRodW1iID0gc2xpZGUub3B0cy4kdGh1bWIsXG4gICAgICAgIHRodW1iUG9zID0gJHRodW1iICYmICR0aHVtYi5sZW5ndGggJiYgJHRodW1iWzBdLm93bmVyRG9jdW1lbnQgPT09IGRvY3VtZW50ID8gJHRodW1iLm9mZnNldCgpIDogMCxcbiAgICAgICAgc2xpZGVQb3M7XG5cbiAgICAgIC8vIENoZWNrIGlmIGVsZW1lbnQgaXMgaW5zaWRlIHRoZSB2aWV3cG9ydCBieSBhdCBsZWFzdCAxIHBpeGVsXG4gICAgICB2YXIgaXNFbGVtZW50VmlzaWJsZSA9IGZ1bmN0aW9uKCRlbCkge1xuICAgICAgICB2YXIgZWxlbWVudCA9ICRlbFswXSxcbiAgICAgICAgICBlbGVtZW50UmVjdCA9IGVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG4gICAgICAgICAgcGFyZW50UmVjdHMgPSBbXSxcbiAgICAgICAgICB2aXNpYmxlSW5BbGxQYXJlbnRzO1xuXG4gICAgICAgIHdoaWxlIChlbGVtZW50LnBhcmVudEVsZW1lbnQgIT09IG51bGwpIHtcbiAgICAgICAgICBpZiAoJChlbGVtZW50LnBhcmVudEVsZW1lbnQpLmNzcyhcIm92ZXJmbG93XCIpID09PSBcImhpZGRlblwiIHx8ICQoZWxlbWVudC5wYXJlbnRFbGVtZW50KS5jc3MoXCJvdmVyZmxvd1wiKSA9PT0gXCJhdXRvXCIpIHtcbiAgICAgICAgICAgIHBhcmVudFJlY3RzLnB1c2goZWxlbWVudC5wYXJlbnRFbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBlbGVtZW50ID0gZWxlbWVudC5wYXJlbnRFbGVtZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgdmlzaWJsZUluQWxsUGFyZW50cyA9IHBhcmVudFJlY3RzLmV2ZXJ5KGZ1bmN0aW9uKHBhcmVudFJlY3QpIHtcbiAgICAgICAgICB2YXIgdmlzaWJsZVBpeGVsWCA9IE1hdGgubWluKGVsZW1lbnRSZWN0LnJpZ2h0LCBwYXJlbnRSZWN0LnJpZ2h0KSAtIE1hdGgubWF4KGVsZW1lbnRSZWN0LmxlZnQsIHBhcmVudFJlY3QubGVmdCk7XG4gICAgICAgICAgdmFyIHZpc2libGVQaXhlbFkgPSBNYXRoLm1pbihlbGVtZW50UmVjdC5ib3R0b20sIHBhcmVudFJlY3QuYm90dG9tKSAtIE1hdGgubWF4KGVsZW1lbnRSZWN0LnRvcCwgcGFyZW50UmVjdC50b3ApO1xuXG4gICAgICAgICAgcmV0dXJuIHZpc2libGVQaXhlbFggPiAwICYmIHZpc2libGVQaXhlbFkgPiAwO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIHZpc2libGVJbkFsbFBhcmVudHMgJiZcbiAgICAgICAgICBlbGVtZW50UmVjdC5ib3R0b20gPiAwICYmXG4gICAgICAgICAgZWxlbWVudFJlY3QucmlnaHQgPiAwICYmXG4gICAgICAgICAgZWxlbWVudFJlY3QubGVmdCA8ICQod2luZG93KS53aWR0aCgpICYmXG4gICAgICAgICAgZWxlbWVudFJlY3QudG9wIDwgJCh3aW5kb3cpLmhlaWdodCgpXG4gICAgICAgICk7XG4gICAgICB9O1xuXG4gICAgICBpZiAodGh1bWJQb3MgJiYgaXNFbGVtZW50VmlzaWJsZSgkdGh1bWIpKSB7XG4gICAgICAgIHNsaWRlUG9zID0gc2VsZi4kcmVmcy5zdGFnZS5vZmZzZXQoKTtcblxuICAgICAgICByZXogPSB7XG4gICAgICAgICAgdG9wOiB0aHVtYlBvcy50b3AgLSBzbGlkZVBvcy50b3AgKyBwYXJzZUZsb2F0KCR0aHVtYi5jc3MoXCJib3JkZXItdG9wLXdpZHRoXCIpIHx8IDApLFxuICAgICAgICAgIGxlZnQ6IHRodW1iUG9zLmxlZnQgLSBzbGlkZVBvcy5sZWZ0ICsgcGFyc2VGbG9hdCgkdGh1bWIuY3NzKFwiYm9yZGVyLWxlZnQtd2lkdGhcIikgfHwgMCksXG4gICAgICAgICAgd2lkdGg6ICR0aHVtYi53aWR0aCgpLFxuICAgICAgICAgIGhlaWdodDogJHRodW1iLmhlaWdodCgpLFxuICAgICAgICAgIHNjYWxlWDogMSxcbiAgICAgICAgICBzY2FsZVk6IDFcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlejtcbiAgICB9LFxuXG4gICAgLy8gRmluYWwgYWRqdXN0bWVudHMgYWZ0ZXIgY3VycmVudCBnYWxsZXJ5IGl0ZW0gaXMgbW92ZWQgdG8gcG9zaXRpb25cbiAgICAvLyBhbmQgaXRgcyBjb250ZW50IGlzIGxvYWRlZFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY29tcGxldGU6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBjdXJyZW50ID0gc2VsZi5jdXJyZW50LFxuICAgICAgICBzbGlkZXMgPSB7fTtcblxuICAgICAgaWYgKGN1cnJlbnQuaXNNb3ZlZCB8fCAhY3VycmVudC5pc0xvYWRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghY3VycmVudC5pc0NvbXBsZXRlKSB7XG4gICAgICAgIGN1cnJlbnQuaXNDb21wbGV0ZSA9IHRydWU7XG5cbiAgICAgICAgY3VycmVudC4kc2xpZGUuc2libGluZ3MoKS50cmlnZ2VyKFwib25SZXNldFwiKTtcblxuICAgICAgICBzZWxmLnByZWxvYWQoXCJpbmxpbmVcIik7XG5cbiAgICAgICAgLy8gVHJpZ2dlciBhbnkgQ1NTMyB0cmFuc2l0b24gaW5zaWRlIHRoZSBzbGlkZVxuICAgICAgICBmb3JjZVJlZHJhdyhjdXJyZW50LiRzbGlkZSk7XG5cbiAgICAgICAgY3VycmVudC4kc2xpZGUuYWRkQ2xhc3MoXCJmYW5jeWJveC1zbGlkZS0tY29tcGxldGVcIik7XG5cbiAgICAgICAgLy8gUmVtb3ZlIHVubmVjZXNzYXJ5IHNsaWRlc1xuICAgICAgICAkLmVhY2goc2VsZi5zbGlkZXMsIGZ1bmN0aW9uKGtleSwgc2xpZGUpIHtcbiAgICAgICAgICBpZiAoc2xpZGUucG9zID49IHNlbGYuY3VyclBvcyAtIDEgJiYgc2xpZGUucG9zIDw9IHNlbGYuY3VyclBvcyArIDEpIHtcbiAgICAgICAgICAgIHNsaWRlc1tzbGlkZS5wb3NdID0gc2xpZGU7XG4gICAgICAgICAgfSBlbHNlIGlmIChzbGlkZSkge1xuICAgICAgICAgICAgJC5mYW5jeWJveC5zdG9wKHNsaWRlLiRzbGlkZSk7XG5cbiAgICAgICAgICAgIHNsaWRlLiRzbGlkZS5vZmYoKS5yZW1vdmUoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNlbGYuc2xpZGVzID0gc2xpZGVzO1xuICAgICAgfVxuXG4gICAgICBzZWxmLmlzQW5pbWF0aW5nID0gZmFsc2U7XG5cbiAgICAgIHNlbGYudXBkYXRlQ3Vyc29yKCk7XG5cbiAgICAgIHNlbGYudHJpZ2dlcihcImFmdGVyU2hvd1wiKTtcblxuICAgICAgLy8gUGxheSBmaXJzdCBodG1sNSB2aWRlby9hdWRpb1xuICAgICAgY3VycmVudC4kc2xpZGVcbiAgICAgICAgLmZpbmQoXCJ2aWRlbyxhdWRpb1wiKVxuICAgICAgICAuZmlsdGVyKFwiOnZpc2libGU6Zmlyc3RcIilcbiAgICAgICAgLnRyaWdnZXIoXCJwbGF5XCIpO1xuXG4gICAgICAvLyBUcnkgdG8gZm9jdXMgb24gdGhlIGZpcnN0IGZvY3VzYWJsZSBlbGVtZW50XG4gICAgICBpZiAoXG4gICAgICAgICQoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkuaXMoXCJbZGlzYWJsZWRdXCIpIHx8XG4gICAgICAgIChjdXJyZW50Lm9wdHMuYXV0b0ZvY3VzICYmICEoY3VycmVudC50eXBlID09IFwiaW1hZ2VcIiB8fCBjdXJyZW50LnR5cGUgPT09IFwiaWZyYW1lXCIpKVxuICAgICAgKSB7XG4gICAgICAgIHNlbGYuZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gUHJlbG9hZCBuZXh0IGFuZCBwcmV2aW91cyBzbGlkZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgcHJlbG9hZDogZnVuY3Rpb24odHlwZSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBuZXh0ID0gc2VsZi5zbGlkZXNbc2VsZi5jdXJyUG9zICsgMV0sXG4gICAgICAgIHByZXYgPSBzZWxmLnNsaWRlc1tzZWxmLmN1cnJQb3MgLSAxXTtcblxuICAgICAgaWYgKG5leHQgJiYgbmV4dC50eXBlID09PSB0eXBlKSB7XG4gICAgICAgIHNlbGYubG9hZFNsaWRlKG5leHQpO1xuICAgICAgfVxuXG4gICAgICBpZiAocHJldiAmJiBwcmV2LnR5cGUgPT09IHR5cGUpIHtcbiAgICAgICAgc2VsZi5sb2FkU2xpZGUocHJldik7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIFRyeSB0byBmaW5kIGFuZCBmb2N1cyBvbiB0aGUgZmlyc3QgZm9jdXNhYmxlIGVsZW1lbnRcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY3VycmVudCA9IHRoaXMuY3VycmVudCxcbiAgICAgICAgJGVsO1xuXG4gICAgICBpZiAodGhpcy5pc0Nsb3NpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoY3VycmVudCAmJiBjdXJyZW50LmlzQ29tcGxldGUgJiYgY3VycmVudC4kY29udGVudCkge1xuICAgICAgICAvLyBMb29rIGZvciBmaXJzdCBpbnB1dCB3aXRoIGF1dG9mb2N1cyBhdHRyaWJ1dGVcbiAgICAgICAgJGVsID0gY3VycmVudC4kY29udGVudC5maW5kKFwiaW5wdXRbYXV0b2ZvY3VzXTplbmFibGVkOnZpc2libGU6Zmlyc3RcIik7XG5cbiAgICAgICAgaWYgKCEkZWwubGVuZ3RoKSB7XG4gICAgICAgICAgJGVsID0gY3VycmVudC4kY29udGVudC5maW5kKFwiYnV0dG9uLDppbnB1dCxbdGFiaW5kZXhdLGFcIikuZmlsdGVyKFwiOmVuYWJsZWQ6dmlzaWJsZTpmaXJzdFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgICRlbCA9ICRlbCAmJiAkZWwubGVuZ3RoID8gJGVsIDogY3VycmVudC4kY29udGVudDtcblxuICAgICAgICAkZWwudHJpZ2dlcihcImZvY3VzXCIpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyBBY3RpdmF0ZXMgY3VycmVudCBpbnN0YW5jZSAtIGJyaW5ncyBjb250YWluZXIgdG8gdGhlIGZyb250IGFuZCBlbmFibGVzIGtleWJvYXJkLFxuICAgIC8vIG5vdGlmaWVzIG90aGVyIGluc3RhbmNlcyBhYm91dCBkZWFjdGl2YXRpbmdcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGFjdGl2YXRlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgLy8gRGVhY3RpdmF0ZSBhbGwgaW5zdGFuY2VzXG4gICAgICAkKFwiLmZhbmN5Ym94LWNvbnRhaW5lclwiKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaW5zdGFuY2UgPSAkKHRoaXMpLmRhdGEoXCJGYW5jeUJveFwiKTtcblxuICAgICAgICAvLyBTa2lwIHNlbGYgYW5kIGNsb3NpbmcgaW5zdGFuY2VzXG4gICAgICAgIGlmIChpbnN0YW5jZSAmJiBpbnN0YW5jZS5pZCAhPT0gc2VsZi5pZCAmJiAhaW5zdGFuY2UuaXNDbG9zaW5nKSB7XG4gICAgICAgICAgaW5zdGFuY2UudHJpZ2dlcihcIm9uRGVhY3RpdmF0ZVwiKTtcblxuICAgICAgICAgIGluc3RhbmNlLnJlbW92ZUV2ZW50cygpO1xuXG4gICAgICAgICAgaW5zdGFuY2UuaXNWaXNpYmxlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBzZWxmLmlzVmlzaWJsZSA9IHRydWU7XG5cbiAgICAgIGlmIChzZWxmLmN1cnJlbnQgfHwgc2VsZi5pc0lkbGUpIHtcbiAgICAgICAgc2VsZi51cGRhdGUoKTtcblxuICAgICAgICBzZWxmLnVwZGF0ZUNvbnRyb2xzKCk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYudHJpZ2dlcihcIm9uQWN0aXZhdGVcIik7XG5cbiAgICAgIHNlbGYuYWRkRXZlbnRzKCk7XG4gICAgfSxcblxuICAgIC8vIFN0YXJ0IGNsb3NpbmcgcHJvY2VkdXJlXG4gICAgLy8gVGhpcyB3aWxsIHN0YXJ0IFwiem9vbS1vdXRcIiBhbmltYXRpb24gaWYgbmVlZGVkIGFuZCBjbGVhbiBldmVyeXRoaW5nIHVwIGFmdGVyd2FyZHNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNsb3NlOiBmdW5jdGlvbihlLCBkKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIGN1cnJlbnQgPSBzZWxmLmN1cnJlbnQsXG4gICAgICAgIGVmZmVjdCxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgICRjb250ZW50LFxuICAgICAgICBkb21SZWN0LFxuICAgICAgICBvcGFjaXR5LFxuICAgICAgICBzdGFydCxcbiAgICAgICAgZW5kO1xuXG4gICAgICB2YXIgZG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLmNsZWFuVXAoZSk7XG4gICAgICB9O1xuXG4gICAgICBpZiAoc2VsZi5pc0Nsb3NpbmcpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBzZWxmLmlzQ2xvc2luZyA9IHRydWU7XG5cbiAgICAgIC8vIElmIGJlZm9yZUNsb3NlIGNhbGxiYWNrIHByZXZlbnRzIGNsb3NpbmcsIG1ha2Ugc3VyZSBjb250ZW50IGlzIGNlbnRlcmVkXG4gICAgICBpZiAoc2VsZi50cmlnZ2VyKFwiYmVmb3JlQ2xvc2VcIiwgZSkgPT09IGZhbHNlKSB7XG4gICAgICAgIHNlbGYuaXNDbG9zaW5nID0gZmFsc2U7XG5cbiAgICAgICAgcmVxdWVzdEFGcmFtZShmdW5jdGlvbigpIHtcbiAgICAgICAgICBzZWxmLnVwZGF0ZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbW92ZSBhbGwgZXZlbnRzXG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgaW5zdGFuY2VzLCB0aGV5IHdpbGwgYmUgc2V0IGFnYWluIGJ5IFwiYWN0aXZhdGVcIiBtZXRob2RcbiAgICAgIHNlbGYucmVtb3ZlRXZlbnRzKCk7XG5cbiAgICAgIGlmIChjdXJyZW50LnRpbW91dHMpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KGN1cnJlbnQudGltb3V0cyk7XG4gICAgICB9XG5cbiAgICAgICRjb250ZW50ID0gY3VycmVudC4kY29udGVudDtcbiAgICAgIGVmZmVjdCA9IGN1cnJlbnQub3B0cy5hbmltYXRpb25FZmZlY3Q7XG4gICAgICBkdXJhdGlvbiA9ICQuaXNOdW1lcmljKGQpID8gZCA6IGVmZmVjdCA/IGN1cnJlbnQub3B0cy5hbmltYXRpb25EdXJhdGlvbiA6IDA7XG5cbiAgICAgIC8vIFJlbW92ZSBvdGhlciBzbGlkZXNcbiAgICAgIGN1cnJlbnQuJHNsaWRlXG4gICAgICAgIC5vZmYodHJhbnNpdGlvbkVuZClcbiAgICAgICAgLnJlbW92ZUNsYXNzKFwiZmFuY3lib3gtc2xpZGUtLWNvbXBsZXRlIGZhbmN5Ym94LXNsaWRlLS1uZXh0IGZhbmN5Ym94LXNsaWRlLS1wcmV2aW91cyBmYW5jeWJveC1hbmltYXRlZFwiKTtcblxuICAgICAgY3VycmVudC4kc2xpZGVcbiAgICAgICAgLnNpYmxpbmdzKClcbiAgICAgICAgLnRyaWdnZXIoXCJvblJlc2V0XCIpXG4gICAgICAgIC5yZW1vdmUoKTtcblxuICAgICAgLy8gVHJpZ2dlciBhbmltYXRpb25zXG4gICAgICBpZiAoZHVyYXRpb24pIHtcbiAgICAgICAgc2VsZi4kcmVmcy5jb250YWluZXIucmVtb3ZlQ2xhc3MoXCJmYW5jeWJveC1pcy1vcGVuXCIpLmFkZENsYXNzKFwiZmFuY3lib3gtaXMtY2xvc2luZ1wiKTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2xlYW4gdXBcbiAgICAgIHNlbGYuaGlkZUxvYWRpbmcoY3VycmVudCk7XG5cbiAgICAgIHNlbGYuaGlkZUNvbnRyb2xzKCk7XG5cbiAgICAgIHNlbGYudXBkYXRlQ3Vyc29yKCk7XG5cbiAgICAgIC8vIENoZWNrIGlmIHBvc3NpYmxlIHRvIHpvb20tb3V0XG4gICAgICBpZiAoXG4gICAgICAgIGVmZmVjdCA9PT0gXCJ6b29tXCIgJiZcbiAgICAgICAgIShlICE9PSB0cnVlICYmICRjb250ZW50ICYmIGR1cmF0aW9uICYmIGN1cnJlbnQudHlwZSA9PT0gXCJpbWFnZVwiICYmICFjdXJyZW50Lmhhc0Vycm9yICYmIChlbmQgPSBzZWxmLmdldFRodW1iUG9zKGN1cnJlbnQpKSlcbiAgICAgICkge1xuICAgICAgICBlZmZlY3QgPSBcImZhZGVcIjtcbiAgICAgIH1cblxuICAgICAgaWYgKGVmZmVjdCA9PT0gXCJ6b29tXCIpIHtcbiAgICAgICAgJC5mYW5jeWJveC5zdG9wKCRjb250ZW50KTtcblxuICAgICAgICBkb21SZWN0ID0gJC5mYW5jeWJveC5nZXRUcmFuc2xhdGUoJGNvbnRlbnQpO1xuXG4gICAgICAgIHN0YXJ0ID0ge1xuICAgICAgICAgIHRvcDogZG9tUmVjdC50b3AsXG4gICAgICAgICAgbGVmdDogZG9tUmVjdC5sZWZ0LFxuICAgICAgICAgIHNjYWxlWDogZG9tUmVjdC53aWR0aCAvIGVuZC53aWR0aCxcbiAgICAgICAgICBzY2FsZVk6IGRvbVJlY3QuaGVpZ2h0IC8gZW5kLmhlaWdodCxcbiAgICAgICAgICB3aWR0aDogZW5kLndpZHRoLFxuICAgICAgICAgIGhlaWdodDogZW5kLmhlaWdodFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIENoZWNrIGlmIHdlIG5lZWQgdG8gYW5pbWF0ZSBvcGFjaXR5XG4gICAgICAgIG9wYWNpdHkgPSBjdXJyZW50Lm9wdHMuem9vbU9wYWNpdHk7XG5cbiAgICAgICAgaWYgKG9wYWNpdHkgPT0gXCJhdXRvXCIpIHtcbiAgICAgICAgICBvcGFjaXR5ID0gTWF0aC5hYnMoY3VycmVudC53aWR0aCAvIGN1cnJlbnQuaGVpZ2h0IC0gZW5kLndpZHRoIC8gZW5kLmhlaWdodCkgPiAwLjE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3BhY2l0eSkge1xuICAgICAgICAgIGVuZC5vcGFjaXR5ID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgICQuZmFuY3lib3guc2V0VHJhbnNsYXRlKCRjb250ZW50LCBzdGFydCk7XG5cbiAgICAgICAgZm9yY2VSZWRyYXcoJGNvbnRlbnQpO1xuXG4gICAgICAgICQuZmFuY3lib3guYW5pbWF0ZSgkY29udGVudCwgZW5kLCBkdXJhdGlvbiwgZG9uZSk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChlZmZlY3QgJiYgZHVyYXRpb24pIHtcbiAgICAgICAgLy8gSWYgc2tpcCBhbmltYXRpb25cbiAgICAgICAgaWYgKGUgPT09IHRydWUpIHtcbiAgICAgICAgICBzZXRUaW1lb3V0KGRvbmUsIGR1cmF0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAkLmZhbmN5Ym94LmFuaW1hdGUoXG4gICAgICAgICAgICBjdXJyZW50LiRzbGlkZS5yZW1vdmVDbGFzcyhcImZhbmN5Ym94LXNsaWRlLS1jdXJyZW50XCIpLFxuICAgICAgICAgICAgXCJmYW5jeWJveC1hbmltYXRlZCBmYW5jeWJveC1zbGlkZS0tcHJldmlvdXMgZmFuY3lib3gtZngtXCIgKyBlZmZlY3QsXG4gICAgICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgICAgIGRvbmVcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb25lKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICAvLyBGaW5hbCBhZGp1c3RtZW50cyBhZnRlciByZW1vdmluZyB0aGUgaW5zdGFuY2VcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNsZWFuVXA6IGZ1bmN0aW9uKGUpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgJGJvZHkgPSAkKFwiYm9keVwiKSxcbiAgICAgICAgaW5zdGFuY2UsXG4gICAgICAgIHNjcm9sbFRvcDtcblxuICAgICAgc2VsZi5jdXJyZW50LiRzbGlkZS50cmlnZ2VyKFwib25SZXNldFwiKTtcblxuICAgICAgc2VsZi4kcmVmcy5jb250YWluZXIuZW1wdHkoKS5yZW1vdmUoKTtcblxuICAgICAgc2VsZi50cmlnZ2VyKFwiYWZ0ZXJDbG9zZVwiLCBlKTtcblxuICAgICAgLy8gUGxhY2UgYmFjayBmb2N1c1xuICAgICAgaWYgKHNlbGYuJGxhc3RGb2N1cyAmJiAhIXNlbGYuY3VycmVudC5vcHRzLmJhY2tGb2N1cykge1xuICAgICAgICBzZWxmLiRsYXN0Rm9jdXMudHJpZ2dlcihcImZvY3VzXCIpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLmN1cnJlbnQgPSBudWxsO1xuXG4gICAgICAvLyBDaGVjayBpZiB0aGVyZSBhcmUgb3RoZXIgaW5zdGFuY2VzXG4gICAgICBpbnN0YW5jZSA9ICQuZmFuY3lib3guZ2V0SW5zdGFuY2UoKTtcblxuICAgICAgaWYgKGluc3RhbmNlKSB7XG4gICAgICAgIGluc3RhbmNlLmFjdGl2YXRlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAkYm9keS5yZW1vdmVDbGFzcyhcImZhbmN5Ym94LWFjdGl2ZSBjb21wZW5zYXRlLWZvci1zY3JvbGxiYXJcIik7XG5cbiAgICAgICAgJChcIiNmYW5jeWJveC1zdHlsZS1ub3Njcm9sbFwiKS5yZW1vdmUoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gQ2FsbCBjYWxsYmFjayBhbmQgdHJpZ2dlciBhbiBldmVudFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRyaWdnZXI6IGZ1bmN0aW9uKG5hbWUsIHNsaWRlKSB7XG4gICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSksXG4gICAgICAgIHNlbGYgPSB0aGlzLFxuICAgICAgICBvYmogPSBzbGlkZSAmJiBzbGlkZS5vcHRzID8gc2xpZGUgOiBzZWxmLmN1cnJlbnQsXG4gICAgICAgIHJlejtcblxuICAgICAgaWYgKG9iaikge1xuICAgICAgICBhcmdzLnVuc2hpZnQob2JqKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9iaiA9IHNlbGY7XG4gICAgICB9XG5cbiAgICAgIGFyZ3MudW5zaGlmdChzZWxmKTtcblxuICAgICAgaWYgKCQuaXNGdW5jdGlvbihvYmoub3B0c1tuYW1lXSkpIHtcbiAgICAgICAgcmV6ID0gb2JqLm9wdHNbbmFtZV0uYXBwbHkob2JqLCBhcmdzKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJleiA9PT0gZmFsc2UpIHtcbiAgICAgICAgcmV0dXJuIHJlejtcbiAgICAgIH1cblxuICAgICAgaWYgKG5hbWUgPT09IFwiYWZ0ZXJDbG9zZVwiIHx8ICFzZWxmLiRyZWZzKSB7XG4gICAgICAgICRELnRyaWdnZXIobmFtZSArIFwiLmZiXCIsIGFyZ3MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi4kcmVmcy5jb250YWluZXIudHJpZ2dlcihuYW1lICsgXCIuZmJcIiwgYXJncyk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIFVwZGF0ZSBpbmZvYmFyIHZhbHVlcywgbmF2aWdhdGlvbiBidXR0b24gc3RhdGVzIGFuZCByZXZlYWwgY2FwdGlvblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdXBkYXRlQ29udHJvbHM6IGZ1bmN0aW9uKGZvcmNlKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIGN1cnJlbnQgPSBzZWxmLmN1cnJlbnQsXG4gICAgICAgIGluZGV4ID0gY3VycmVudC5pbmRleCxcbiAgICAgICAgY2FwdGlvbiA9IGN1cnJlbnQub3B0cy5jYXB0aW9uLFxuICAgICAgICAkY29udGFpbmVyID0gc2VsZi4kcmVmcy5jb250YWluZXIsXG4gICAgICAgICRjYXB0aW9uID0gc2VsZi4kcmVmcy5jYXB0aW9uO1xuXG4gICAgICAvLyBSZWNhbGN1bGF0ZSBjb250ZW50IGRpbWVuc2lvbnNcbiAgICAgIGN1cnJlbnQuJHNsaWRlLnRyaWdnZXIoXCJyZWZyZXNoXCIpO1xuXG4gICAgICBzZWxmLiRjYXB0aW9uID0gY2FwdGlvbiAmJiBjYXB0aW9uLmxlbmd0aCA/ICRjYXB0aW9uLmh0bWwoY2FwdGlvbikgOiBudWxsO1xuXG4gICAgICBpZiAoIXNlbGYuaXNIaWRkZW5Db250cm9scyAmJiAhc2VsZi5pc0lkbGUpIHtcbiAgICAgICAgc2VsZi5zaG93Q29udHJvbHMoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVXBkYXRlIGluZm8gYW5kIG5hdmlnYXRpb24gZWxlbWVudHNcbiAgICAgICRjb250YWluZXIuZmluZChcIltkYXRhLWZhbmN5Ym94LWNvdW50XVwiKS5odG1sKHNlbGYuZ3JvdXAubGVuZ3RoKTtcbiAgICAgICRjb250YWluZXIuZmluZChcIltkYXRhLWZhbmN5Ym94LWluZGV4XVwiKS5odG1sKGluZGV4ICsgMSk7XG5cbiAgICAgICRjb250YWluZXIuZmluZChcIltkYXRhLWZhbmN5Ym94LXByZXZdXCIpLnRvZ2dsZUNsYXNzKFwiZGlzYWJsZWRcIiwgIWN1cnJlbnQub3B0cy5sb29wICYmIGluZGV4IDw9IDApO1xuICAgICAgJGNvbnRhaW5lci5maW5kKFwiW2RhdGEtZmFuY3lib3gtbmV4dF1cIikudG9nZ2xlQ2xhc3MoXCJkaXNhYmxlZFwiLCAhY3VycmVudC5vcHRzLmxvb3AgJiYgaW5kZXggPj0gc2VsZi5ncm91cC5sZW5ndGggLSAxKTtcblxuICAgICAgaWYgKGN1cnJlbnQudHlwZSA9PT0gXCJpbWFnZVwiKSB7XG4gICAgICAgIC8vIFJlLWVuYWJsZSBidXR0b25zOyB1cGRhdGUgZG93bmxvYWQgYnV0dG9uIHNvdXJjZVxuICAgICAgICAkY29udGFpbmVyXG4gICAgICAgICAgLmZpbmQoXCJbZGF0YS1mYW5jeWJveC16b29tXVwiKVxuICAgICAgICAgIC5zaG93KClcbiAgICAgICAgICAuZW5kKClcbiAgICAgICAgICAuZmluZChcIltkYXRhLWZhbmN5Ym94LWRvd25sb2FkXVwiKVxuICAgICAgICAgIC5hdHRyKFwiaHJlZlwiLCBjdXJyZW50Lm9wdHMuaW1hZ2Uuc3JjIHx8IGN1cnJlbnQuc3JjKVxuICAgICAgICAgIC5zaG93KCk7XG4gICAgICB9IGVsc2UgaWYgKGN1cnJlbnQub3B0cy50b29sYmFyKSB7XG4gICAgICAgICRjb250YWluZXIuZmluZChcIltkYXRhLWZhbmN5Ym94LWRvd25sb2FkXSxbZGF0YS1mYW5jeWJveC16b29tXVwiKS5oaWRlKCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIEhpZGUgdG9vbGJhciBhbmQgY2FwdGlvblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgaGlkZUNvbnRyb2xzOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuaXNIaWRkZW5Db250cm9scyA9IHRydWU7XG5cbiAgICAgIHRoaXMuJHJlZnMuY29udGFpbmVyLnJlbW92ZUNsYXNzKFwiZmFuY3lib3gtc2hvdy1pbmZvYmFyIGZhbmN5Ym94LXNob3ctdG9vbGJhciBmYW5jeWJveC1zaG93LWNhcHRpb24gZmFuY3lib3gtc2hvdy1uYXZcIik7XG4gICAgfSxcblxuICAgIHNob3dDb250cm9sczogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgIG9wdHMgPSBzZWxmLmN1cnJlbnQgPyBzZWxmLmN1cnJlbnQub3B0cyA6IHNlbGYub3B0cyxcbiAgICAgICAgJGNvbnRhaW5lciA9IHNlbGYuJHJlZnMuY29udGFpbmVyO1xuXG4gICAgICBzZWxmLmlzSGlkZGVuQ29udHJvbHMgPSBmYWxzZTtcbiAgICAgIHNlbGYuaWRsZVNlY29uZHNDb3VudGVyID0gMDtcblxuICAgICAgJGNvbnRhaW5lclxuICAgICAgICAudG9nZ2xlQ2xhc3MoXCJmYW5jeWJveC1zaG93LXRvb2xiYXJcIiwgISEob3B0cy50b29sYmFyICYmIG9wdHMuYnV0dG9ucykpXG4gICAgICAgIC50b2dnbGVDbGFzcyhcImZhbmN5Ym94LXNob3ctaW5mb2JhclwiLCAhIShvcHRzLmluZm9iYXIgJiYgc2VsZi5ncm91cC5sZW5ndGggPiAxKSlcbiAgICAgICAgLnRvZ2dsZUNsYXNzKFwiZmFuY3lib3gtc2hvdy1uYXZcIiwgISEob3B0cy5hcnJvd3MgJiYgc2VsZi5ncm91cC5sZW5ndGggPiAxKSlcbiAgICAgICAgLnRvZ2dsZUNsYXNzKFwiZmFuY3lib3gtaXMtbW9kYWxcIiwgISFvcHRzLm1vZGFsKTtcblxuICAgICAgaWYgKHNlbGYuJGNhcHRpb24pIHtcbiAgICAgICAgJGNvbnRhaW5lci5hZGRDbGFzcyhcImZhbmN5Ym94LXNob3ctY2FwdGlvbiBcIik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAkY29udGFpbmVyLnJlbW92ZUNsYXNzKFwiZmFuY3lib3gtc2hvdy1jYXB0aW9uXCIpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyBUb2dnbGUgdG9vbGJhciBhbmQgY2FwdGlvblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICB0b2dnbGVDb250cm9sczogZnVuY3Rpb24oKSB7XG4gICAgICBpZiAodGhpcy5pc0hpZGRlbkNvbnRyb2xzKSB7XG4gICAgICAgIHRoaXMuc2hvd0NvbnRyb2xzKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmhpZGVDb250cm9scygpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgJC5mYW5jeWJveCA9IHtcbiAgICB2ZXJzaW9uOiBcIjMuMy41XCIsXG4gICAgZGVmYXVsdHM6IGRlZmF1bHRzLFxuXG4gICAgLy8gR2V0IGN1cnJlbnQgaW5zdGFuY2UgYW5kIGV4ZWN1dGUgYSBjb21tYW5kLlxuICAgIC8vXG4gICAgLy8gRXhhbXBsZXMgb2YgdXNhZ2U6XG4gICAgLy9cbiAgICAvLyAgICRpbnN0YW5jZSA9ICQuZmFuY3lib3guZ2V0SW5zdGFuY2UoKTtcbiAgICAvLyAgICQuZmFuY3lib3guZ2V0SW5zdGFuY2UoKS5qdW1wVG8oIDEgKTtcbiAgICAvLyAgICQuZmFuY3lib3guZ2V0SW5zdGFuY2UoICdqdW1wVG8nLCAxICk7XG4gICAgLy8gICAkLmZhbmN5Ym94LmdldEluc3RhbmNlKCBmdW5jdGlvbigpIHtcbiAgICAvLyAgICAgICBjb25zb2xlLmluZm8oIHRoaXMuY3VyckluZGV4ICk7XG4gICAgLy8gICB9KTtcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGdldEluc3RhbmNlOiBmdW5jdGlvbihjb21tYW5kKSB7XG4gICAgICB2YXIgaW5zdGFuY2UgPSAkKCcuZmFuY3lib3gtY29udGFpbmVyOm5vdChcIi5mYW5jeWJveC1pcy1jbG9zaW5nXCIpOmxhc3QnKS5kYXRhKFwiRmFuY3lCb3hcIiksXG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gICAgICBpZiAoaW5zdGFuY2UgaW5zdGFuY2VvZiBGYW5jeUJveCkge1xuICAgICAgICBpZiAoJC50eXBlKGNvbW1hbmQpID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgaW5zdGFuY2VbY29tbWFuZF0uYXBwbHkoaW5zdGFuY2UsIGFyZ3MpO1xuICAgICAgICB9IGVsc2UgaWYgKCQudHlwZShjb21tYW5kKSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgY29tbWFuZC5hcHBseShpbnN0YW5jZSwgYXJncyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5zdGFuY2U7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgLy8gQ3JlYXRlIG5ldyBpbnN0YW5jZVxuICAgIC8vID09PT09PT09PT09PT09PT09PT1cblxuICAgIG9wZW46IGZ1bmN0aW9uKGl0ZW1zLCBvcHRzLCBpbmRleCkge1xuICAgICAgcmV0dXJuIG5ldyBGYW5jeUJveChpdGVtcywgb3B0cywgaW5kZXgpO1xuICAgIH0sXG5cbiAgICAvLyBDbG9zZSBjdXJyZW50IG9yIGFsbCBpbnN0YW5jZXNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNsb3NlOiBmdW5jdGlvbihhbGwpIHtcbiAgICAgIHZhciBpbnN0YW5jZSA9IHRoaXMuZ2V0SW5zdGFuY2UoKTtcblxuICAgICAgaWYgKGluc3RhbmNlKSB7XG4gICAgICAgIGluc3RhbmNlLmNsb3NlKCk7XG5cbiAgICAgICAgLy8gVHJ5IHRvIGZpbmQgYW5kIGNsb3NlIG5leHQgaW5zdGFuY2VcblxuICAgICAgICBpZiAoYWxsID09PSB0cnVlKSB7XG4gICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8vIENsb3NlIGFsbCBpbnN0YW5jZXMgYW5kIHVuYmluZCBhbGwgZXZlbnRzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5jbG9zZSh0cnVlKTtcblxuICAgICAgJEQuYWRkKFwiYm9keVwiKS5vZmYoXCJjbGljay5mYi1zdGFydFwiLCBcIioqXCIpO1xuICAgIH0sXG5cbiAgICAvLyBUcnkgdG8gZGV0ZWN0IG1vYmlsZSBkZXZpY2VzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgaXNNb2JpbGU6XG4gICAgICBkb2N1bWVudC5jcmVhdGVUb3VjaCAhPT0gdW5kZWZpbmVkICYmIC9BbmRyb2lkfHdlYk9TfGlQaG9uZXxpUGFkfGlQb2R8QmxhY2tCZXJyeXxJRU1vYmlsZXxPcGVyYSBNaW5pL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSxcblxuICAgIC8vIERldGVjdCBpZiAndHJhbnNsYXRlM2QnIHN1cHBvcnQgaXMgYXZhaWxhYmxlXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHVzZTNkOiAoZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblxuICAgICAgcmV0dXJuIChcbiAgICAgICAgd2luZG93LmdldENvbXB1dGVkU3R5bGUgJiZcbiAgICAgICAgd2luZG93LmdldENvbXB1dGVkU3R5bGUoZGl2KSAmJlxuICAgICAgICB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkaXYpLmdldFByb3BlcnR5VmFsdWUoXCJ0cmFuc2Zvcm1cIikgJiZcbiAgICAgICAgIShkb2N1bWVudC5kb2N1bWVudE1vZGUgJiYgZG9jdW1lbnQuZG9jdW1lbnRNb2RlIDwgMTEpXG4gICAgICApO1xuICAgIH0pKCksXG5cbiAgICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gZ2V0IGN1cnJlbnQgdmlzdWFsIHN0YXRlIG9mIGFuIGVsZW1lbnRcbiAgICAvLyByZXR1cm5zIGFycmF5WyB0b3AsIGxlZnQsIGhvcml6b250YWwtc2NhbGUsIHZlcnRpY2FsLXNjYWxlLCBvcGFjaXR5IF1cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGdldFRyYW5zbGF0ZTogZnVuY3Rpb24oJGVsKSB7XG4gICAgICB2YXIgZG9tUmVjdDtcblxuICAgICAgaWYgKCEkZWwgfHwgISRlbC5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBkb21SZWN0ID0gJGVsWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0b3A6IGRvbVJlY3QudG9wIHx8IDAsXG4gICAgICAgIGxlZnQ6IGRvbVJlY3QubGVmdCB8fCAwLFxuICAgICAgICB3aWR0aDogZG9tUmVjdC53aWR0aCxcbiAgICAgICAgaGVpZ2h0OiBkb21SZWN0LmhlaWdodCxcbiAgICAgICAgb3BhY2l0eTogcGFyc2VGbG9hdCgkZWwuY3NzKFwib3BhY2l0eVwiKSlcbiAgICAgIH07XG4gICAgfSxcblxuICAgIC8vIFNob3J0Y3V0IGZvciBzZXR0aW5nIFwidHJhbnNsYXRlM2RcIiBwcm9wZXJ0aWVzIGZvciBlbGVtZW50XG4gICAgLy8gQ2FuIHNldCBiZSB1c2VkIHRvIHNldCBvcGFjaXR5LCB0b29cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgc2V0VHJhbnNsYXRlOiBmdW5jdGlvbigkZWwsIHByb3BzKSB7XG4gICAgICB2YXIgc3RyID0gXCJcIixcbiAgICAgICAgY3NzID0ge307XG5cbiAgICAgIGlmICghJGVsIHx8ICFwcm9wcykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChwcm9wcy5sZWZ0ICE9PSB1bmRlZmluZWQgfHwgcHJvcHMudG9wICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RyID1cbiAgICAgICAgICAocHJvcHMubGVmdCA9PT0gdW5kZWZpbmVkID8gJGVsLnBvc2l0aW9uKCkubGVmdCA6IHByb3BzLmxlZnQpICtcbiAgICAgICAgICBcInB4LCBcIiArXG4gICAgICAgICAgKHByb3BzLnRvcCA9PT0gdW5kZWZpbmVkID8gJGVsLnBvc2l0aW9uKCkudG9wIDogcHJvcHMudG9wKSArXG4gICAgICAgICAgXCJweFwiO1xuXG4gICAgICAgIGlmICh0aGlzLnVzZTNkKSB7XG4gICAgICAgICAgc3RyID0gXCJ0cmFuc2xhdGUzZChcIiArIHN0ciArIFwiLCAwcHgpXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyID0gXCJ0cmFuc2xhdGUoXCIgKyBzdHIgKyBcIilcIjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocHJvcHMuc2NhbGVYICE9PSB1bmRlZmluZWQgJiYgcHJvcHMuc2NhbGVZICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc3RyID0gKHN0ci5sZW5ndGggPyBzdHIgKyBcIiBcIiA6IFwiXCIpICsgXCJzY2FsZShcIiArIHByb3BzLnNjYWxlWCArIFwiLCBcIiArIHByb3BzLnNjYWxlWSArIFwiKVwiO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RyLmxlbmd0aCkge1xuICAgICAgICBjc3MudHJhbnNmb3JtID0gc3RyO1xuICAgICAgfVxuXG4gICAgICBpZiAocHJvcHMub3BhY2l0eSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNzcy5vcGFjaXR5ID0gcHJvcHMub3BhY2l0eTtcbiAgICAgIH1cblxuICAgICAgaWYgKHByb3BzLndpZHRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY3NzLndpZHRoID0gcHJvcHMud2lkdGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChwcm9wcy5oZWlnaHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjc3MuaGVpZ2h0ID0gcHJvcHMuaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gJGVsLmNzcyhjc3MpO1xuICAgIH0sXG5cbiAgICAvLyBTaW1wbGUgQ1NTIHRyYW5zaXRpb24gaGFuZGxlclxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBhbmltYXRlOiBmdW5jdGlvbigkZWwsIHRvLCBkdXJhdGlvbiwgY2FsbGJhY2ssIGxlYXZlQW5pbWF0aW9uTmFtZSkge1xuICAgICAgdmFyIGZpbmFsID0gZmFsc2U7XG5cbiAgICAgIGlmICgkLmlzRnVuY3Rpb24oZHVyYXRpb24pKSB7XG4gICAgICAgIGNhbGxiYWNrID0gZHVyYXRpb247XG4gICAgICAgIGR1cmF0aW9uID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgaWYgKCEkLmlzUGxhaW5PYmplY3QodG8pKSB7XG4gICAgICAgICRlbC5yZW1vdmVBdHRyKFwic3R5bGVcIik7XG4gICAgICB9XG5cbiAgICAgICQuZmFuY3lib3guc3RvcCgkZWwpO1xuXG4gICAgICAkZWwub24odHJhbnNpdGlvbkVuZCwgZnVuY3Rpb24oZSkge1xuICAgICAgICAvLyBTa2lwIGV2ZW50cyBmcm9tIGNoaWxkIGVsZW1lbnRzIGFuZCB6LWluZGV4IGNoYW5nZVxuICAgICAgICBpZiAoZSAmJiBlLm9yaWdpbmFsRXZlbnQgJiYgKCEkZWwuaXMoZS5vcmlnaW5hbEV2ZW50LnRhcmdldCkgfHwgZS5vcmlnaW5hbEV2ZW50LnByb3BlcnR5TmFtZSA9PSBcInotaW5kZXhcIikpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAkLmZhbmN5Ym94LnN0b3AoJGVsKTtcblxuICAgICAgICBpZiAoZmluYWwpIHtcbiAgICAgICAgICAkLmZhbmN5Ym94LnNldFRyYW5zbGF0ZSgkZWwsIGZpbmFsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgkLmlzUGxhaW5PYmplY3QodG8pKSB7XG4gICAgICAgICAgaWYgKGxlYXZlQW5pbWF0aW9uTmFtZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICRlbC5yZW1vdmVBdHRyKFwic3R5bGVcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGxlYXZlQW5pbWF0aW9uTmFtZSAhPT0gdHJ1ZSkge1xuICAgICAgICAgICRlbC5yZW1vdmVDbGFzcyh0byk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoJC5pc0Z1bmN0aW9uKGNhbGxiYWNrKSkge1xuICAgICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKCQuaXNOdW1lcmljKGR1cmF0aW9uKSkge1xuICAgICAgICAkZWwuY3NzKFwidHJhbnNpdGlvbi1kdXJhdGlvblwiLCBkdXJhdGlvbiArIFwibXNcIik7XG4gICAgICB9XG5cbiAgICAgIC8vIFN0YXJ0IGFuaW1hdGlvbiBieSBjaGFuZ2luZyBDU1MgcHJvcGVydGllcyBvciBjbGFzcyBuYW1lXG4gICAgICBpZiAoJC5pc1BsYWluT2JqZWN0KHRvKSkge1xuICAgICAgICBpZiAodG8uc2NhbGVYICE9PSB1bmRlZmluZWQgJiYgdG8uc2NhbGVZICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBmaW5hbCA9ICQuZXh0ZW5kKHt9LCB0bywge1xuICAgICAgICAgICAgd2lkdGg6ICRlbC53aWR0aCgpICogdG8uc2NhbGVYLFxuICAgICAgICAgICAgaGVpZ2h0OiAkZWwuaGVpZ2h0KCkgKiB0by5zY2FsZVksXG4gICAgICAgICAgICBzY2FsZVg6IDEsXG4gICAgICAgICAgICBzY2FsZVk6IDFcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGRlbGV0ZSB0by53aWR0aDtcbiAgICAgICAgICBkZWxldGUgdG8uaGVpZ2h0O1xuXG4gICAgICAgICAgaWYgKCRlbC5wYXJlbnQoKS5oYXNDbGFzcyhcImZhbmN5Ym94LXNsaWRlLS1pbWFnZVwiKSkge1xuICAgICAgICAgICAgJGVsLnBhcmVudCgpLmFkZENsYXNzKFwiZmFuY3lib3gtaXMtc2NhbGluZ1wiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAkLmZhbmN5Ym94LnNldFRyYW5zbGF0ZSgkZWwsIHRvKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICRlbC5hZGRDbGFzcyh0byk7XG4gICAgICB9XG5cbiAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IGB0cmFuc2l0aW9uZW5kYCBjYWxsYmFjayBnZXRzIGZpcmVkXG4gICAgICAkZWwuZGF0YShcbiAgICAgICAgXCJ0aW1lclwiLFxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICRlbC50cmlnZ2VyKFwidHJhbnNpdGlvbmVuZFwiKTtcbiAgICAgICAgfSwgZHVyYXRpb24gKyAxNilcbiAgICAgICk7XG4gICAgfSxcblxuICAgIHN0b3A6IGZ1bmN0aW9uKCRlbCkge1xuICAgICAgaWYgKCRlbCAmJiAkZWwubGVuZ3RoKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCgkZWwuZGF0YShcInRpbWVyXCIpKTtcblxuICAgICAgICAkZWwub2ZmKFwidHJhbnNpdGlvbmVuZFwiKS5jc3MoXCJ0cmFuc2l0aW9uLWR1cmF0aW9uXCIsIFwiXCIpO1xuXG4gICAgICAgICRlbC5wYXJlbnQoKS5yZW1vdmVDbGFzcyhcImZhbmN5Ym94LWlzLXNjYWxpbmdcIik7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8vIERlZmF1bHQgY2xpY2sgaGFuZGxlciBmb3IgXCJmYW5jeWJveGVkXCIgbGlua3NcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICBmdW5jdGlvbiBfcnVuKGUsIG9wdHMpIHtcbiAgICB2YXIgaXRlbXMgPSBbXSxcbiAgICAgIGluZGV4ID0gMCxcbiAgICAgICR0YXJnZXQsXG4gICAgICB2YWx1ZTtcblxuICAgIC8vIEF2b2lkIG9wZW5pbmcgbXVsdGlwbGUgdGltZXNcbiAgICBpZiAoZSAmJiBlLmlzRGVmYXVsdFByZXZlbnRlZCgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgb3B0cyA9IGUgJiYgZS5kYXRhID8gZS5kYXRhLm9wdGlvbnMgOiBvcHRzIHx8IHt9O1xuXG4gICAgJHRhcmdldCA9IG9wdHMuJHRhcmdldCB8fCAkKGUuY3VycmVudFRhcmdldCk7XG4gICAgdmFsdWUgPSAkdGFyZ2V0LmF0dHIoXCJkYXRhLWZhbmN5Ym94XCIpIHx8IFwiXCI7XG5cbiAgICAvLyBHZXQgYWxsIHJlbGF0ZWQgaXRlbXMgYW5kIGZpbmQgaW5kZXggZm9yIGNsaWNrZWQgb25lXG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICBpdGVtcyA9IG9wdHMuc2VsZWN0b3IgPyAkKG9wdHMuc2VsZWN0b3IpIDogZS5kYXRhID8gZS5kYXRhLml0ZW1zIDogW107XG4gICAgICBpdGVtcyA9IGl0ZW1zLmxlbmd0aCA/IGl0ZW1zLmZpbHRlcignW2RhdGEtZmFuY3lib3g9XCInICsgdmFsdWUgKyAnXCJdJykgOiAkKCdbZGF0YS1mYW5jeWJveD1cIicgKyB2YWx1ZSArICdcIl0nKTtcblxuICAgICAgaW5kZXggPSBpdGVtcy5pbmRleCgkdGFyZ2V0KTtcblxuICAgICAgLy8gU29tZXRpbWVzIGN1cnJlbnQgaXRlbSBjYW4gbm90IGJlIGZvdW5kIChmb3IgZXhhbXBsZSwgaWYgc29tZSBzY3JpcHQgY2xvbmVzIGl0ZW1zKVxuICAgICAgaWYgKGluZGV4IDwgMCkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGl0ZW1zID0gWyR0YXJnZXRdO1xuICAgIH1cblxuICAgICQuZmFuY3lib3gub3BlbihpdGVtcywgb3B0cywgaW5kZXgpO1xuICB9XG5cbiAgLy8gQ3JlYXRlIGEgalF1ZXJ5IHBsdWdpblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09XG5cbiAgJC5mbi5mYW5jeWJveCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICB2YXIgc2VsZWN0b3I7XG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICBzZWxlY3RvciA9IG9wdGlvbnMuc2VsZWN0b3IgfHwgZmFsc2U7XG5cbiAgICBpZiAoc2VsZWN0b3IpIHtcbiAgICAgIC8vIFVzZSBib2R5IGVsZW1lbnQgaW5zdGVhZCBvZiBkb2N1bWVudCBzbyBpdCBleGVjdXRlcyBmaXJzdFxuICAgICAgJChcImJvZHlcIilcbiAgICAgICAgLm9mZihcImNsaWNrLmZiLXN0YXJ0XCIsIHNlbGVjdG9yKVxuICAgICAgICAub24oXCJjbGljay5mYi1zdGFydFwiLCBzZWxlY3Rvciwge29wdGlvbnM6IG9wdGlvbnN9LCBfcnVuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vZmYoXCJjbGljay5mYi1zdGFydFwiKS5vbihcbiAgICAgICAgXCJjbGljay5mYi1zdGFydFwiLFxuICAgICAgICB7XG4gICAgICAgICAgaXRlbXM6IHRoaXMsXG4gICAgICAgICAgb3B0aW9uczogb3B0aW9uc1xuICAgICAgICB9LFxuICAgICAgICBfcnVuXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8vIFNlbGYgaW5pdGlhbGl6aW5nIHBsdWdpbiBmb3IgYWxsIGVsZW1lbnRzIGhhdmluZyBgZGF0YS1mYW5jeWJveGAgYXR0cmlidXRlXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgJEQub24oXCJjbGljay5mYi1zdGFydFwiLCBcIltkYXRhLWZhbmN5Ym94XVwiLCBfcnVuKTtcblxuICAvLyBFbmFibGUgXCJ0cmlnZ2VyIGVsZW1lbnRzXCJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICRELm9uKFwiY2xpY2suZmItc3RhcnRcIiwgXCJbZGF0YS10cmlnZ2VyXVwiLCBmdW5jdGlvbihlKSB7XG4gICAgX3J1bihlLCB7XG4gICAgICAkdGFyZ2V0OiAkKCdbZGF0YS1mYW5jeWJveD1cIicgKyAkKGUuY3VycmVudFRhcmdldCkuYXR0cihcImRhdGEtdHJpZ2dlclwiKSArICdcIl0nKS5lcSgkKGUuY3VycmVudFRhcmdldCkuYXR0cihcImRhdGEtaW5kZXhcIikgfHwgMCksXG4gICAgICAkdHJpZ2dlcjogJCh0aGlzKVxuICAgIH0pO1xuICB9KTtcbn0pKHdpbmRvdywgZG9jdW1lbnQsIHdpbmRvdy5qUXVlcnkgfHwgalF1ZXJ5KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vXG4vLyBNZWRpYVxuLy8gQWRkcyBhZGRpdGlvbmFsIG1lZGlhIHR5cGUgc3VwcG9ydFxuLy9cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4oZnVuY3Rpb24oJCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICAvLyBGb3JtYXRzIG1hdGNoaW5nIHVybCB0byBmaW5hbCBmb3JtXG5cbiAgdmFyIGZvcm1hdCA9IGZ1bmN0aW9uKHVybCwgcmV6LCBwYXJhbXMpIHtcbiAgICBpZiAoIXVybCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHBhcmFtcyA9IHBhcmFtcyB8fCBcIlwiO1xuXG4gICAgaWYgKCQudHlwZShwYXJhbXMpID09PSBcIm9iamVjdFwiKSB7XG4gICAgICBwYXJhbXMgPSAkLnBhcmFtKHBhcmFtcywgdHJ1ZSk7XG4gICAgfVxuXG4gICAgJC5lYWNoKHJleiwgZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuICAgICAgdXJsID0gdXJsLnJlcGxhY2UoXCIkXCIgKyBrZXksIHZhbHVlIHx8IFwiXCIpO1xuICAgIH0pO1xuXG4gICAgaWYgKHBhcmFtcy5sZW5ndGgpIHtcbiAgICAgIHVybCArPSAodXJsLmluZGV4T2YoXCI/XCIpID4gMCA/IFwiJlwiIDogXCI/XCIpICsgcGFyYW1zO1xuICAgIH1cblxuICAgIHJldHVybiB1cmw7XG4gIH07XG5cbiAgLy8gT2JqZWN0IGNvbnRhaW5pbmcgcHJvcGVydGllcyBmb3IgZWFjaCBtZWRpYSB0eXBlXG5cbiAgdmFyIGRlZmF1bHRzID0ge1xuICAgIHlvdXR1YmU6IHtcbiAgICAgIG1hdGNoZXI6IC8oeW91dHViZVxcLmNvbXx5b3V0dVxcLmJlfHlvdXR1YmVcXC1ub2Nvb2tpZVxcLmNvbSlcXC8od2F0Y2hcXD8oLiomKT92PXx2XFwvfHVcXC98ZW1iZWRcXC8/KT8odmlkZW9zZXJpZXNcXD9saXN0PSguKil8W1xcdy1dezExfXxcXD9saXN0VHlwZT0oLiopJmxpc3Q9KC4qKSkoLiopL2ksXG4gICAgICBwYXJhbXM6IHtcbiAgICAgICAgYXV0b3BsYXk6IDEsXG4gICAgICAgIGF1dG9oaWRlOiAxLFxuICAgICAgICBmczogMSxcbiAgICAgICAgcmVsOiAwLFxuICAgICAgICBoZDogMSxcbiAgICAgICAgd21vZGU6IFwidHJhbnNwYXJlbnRcIixcbiAgICAgICAgZW5hYmxlanNhcGk6IDEsXG4gICAgICAgIGh0bWw1OiAxXG4gICAgICB9LFxuICAgICAgcGFyYW1QbGFjZTogOCxcbiAgICAgIHR5cGU6IFwiaWZyYW1lXCIsXG4gICAgICB1cmw6IFwiLy93d3cueW91dHViZS5jb20vZW1iZWQvJDRcIixcbiAgICAgIHRodW1iOiBcIi8vaW1nLnlvdXR1YmUuY29tL3ZpLyQ0L2hxZGVmYXVsdC5qcGdcIlxuICAgIH0sXG5cbiAgICB2aW1lbzoge1xuICAgICAgbWF0Y2hlcjogL14uK3ZpbWVvLmNvbVxcLyguKlxcLyk/KFtcXGRdKykoLiopPy8sXG4gICAgICBwYXJhbXM6IHtcbiAgICAgICAgYXV0b3BsYXk6IDEsXG4gICAgICAgIGhkOiAxLFxuICAgICAgICBzaG93X3RpdGxlOiAxLFxuICAgICAgICBzaG93X2J5bGluZTogMSxcbiAgICAgICAgc2hvd19wb3J0cmFpdDogMCxcbiAgICAgICAgZnVsbHNjcmVlbjogMSxcbiAgICAgICAgYXBpOiAxXG4gICAgICB9LFxuICAgICAgcGFyYW1QbGFjZTogMyxcbiAgICAgIHR5cGU6IFwiaWZyYW1lXCIsXG4gICAgICB1cmw6IFwiLy9wbGF5ZXIudmltZW8uY29tL3ZpZGVvLyQyXCJcbiAgICB9LFxuXG4gICAgaW5zdGFncmFtOiB7XG4gICAgICBtYXRjaGVyOiAvKGluc3RhZ3JcXC5hbXxpbnN0YWdyYW1cXC5jb20pXFwvcFxcLyhbYS16QS1aMC05X1xcLV0rKVxcLz8vaSxcbiAgICAgIHR5cGU6IFwiaW1hZ2VcIixcbiAgICAgIHVybDogXCIvLyQxL3AvJDIvbWVkaWEvP3NpemU9bFwiXG4gICAgfSxcblxuICAgIC8vIEV4YW1wbGVzOlxuICAgIC8vIGh0dHA6Ly9tYXBzLmdvb2dsZS5jb20vP2xsPTQ4Ljg1Nzk5NSwyLjI5NDI5NyZzcG49MC4wMDc2NjYsMC4wMjExMzYmdD1tJno9MTZcbiAgICAvLyBodHRwczovL3d3dy5nb29nbGUuY29tL21hcHMvQDM3Ljc4NTIwMDYsLTEyMi40MTQ2MzU1LDE0LjY1elxuICAgIC8vIGh0dHBzOi8vd3d3Lmdvb2dsZS5jb20vbWFwcy9ANTIuMjExMTEyMywyLjkyMzc1NDIsNi42MXo/aGw9ZW5cbiAgICAvLyBodHRwczovL3d3dy5nb29nbGUuY29tL21hcHMvcGxhY2UvR29vZ2xlcGxleC9AMzcuNDIyMDA0MSwtMTIyLjA4MzM0OTQsMTd6L2RhdGE9ITRtNSEzbTQhMXMweDA6MHg2YzI5NmM2NjYxOTM2N2UwIThtMiEzZDM3LjQyMTk5OTghNGQtMTIyLjA4NDA1NzJcbiAgICBnbWFwX3BsYWNlOiB7XG4gICAgICBtYXRjaGVyOiAvKG1hcHNcXC4pP2dvb2dsZVxcLihbYS16XXsyLDN9KFxcLlthLXpdezJ9KT8pXFwvKCgobWFwc1xcLyhwbGFjZVxcLyguKilcXC8pP1xcQCguKiksKFxcZCsuP1xcZCs/KXopKXwoXFw/bGw9KSkoLiopPy9pLFxuICAgICAgdHlwZTogXCJpZnJhbWVcIixcbiAgICAgIHVybDogZnVuY3Rpb24ocmV6KSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgXCIvL21hcHMuZ29vZ2xlLlwiICtcbiAgICAgICAgICByZXpbMl0gK1xuICAgICAgICAgIFwiLz9sbD1cIiArXG4gICAgICAgICAgKHJlels5XSA/IHJlels5XSArIFwiJno9XCIgKyBNYXRoLmZsb29yKHJlelsxMF0pICsgKHJlelsxMl0gPyByZXpbMTJdLnJlcGxhY2UoL15cXC8vLCBcIiZcIikgOiBcIlwiKSA6IHJlelsxMl0gKyBcIlwiKS5yZXBsYWNlKC9cXD8vLCBcIiZcIikgK1xuICAgICAgICAgIFwiJm91dHB1dD1cIiArXG4gICAgICAgICAgKHJlelsxMl0gJiYgcmV6WzEyXS5pbmRleE9mKFwibGF5ZXI9Y1wiKSA+IDAgPyBcInN2ZW1iZWRcIiA6IFwiZW1iZWRcIilcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLy8gRXhhbXBsZXM6XG4gICAgLy8gaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9tYXBzL3NlYXJjaC9FbXBpcmUrU3RhdGUrQnVpbGRpbmcvXG4gICAgLy8gaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9tYXBzL3NlYXJjaC8/YXBpPTEmcXVlcnk9Y2VudHVyeWxpbmsrZmllbGRcbiAgICAvLyBodHRwczovL3d3dy5nb29nbGUuY29tL21hcHMvc2VhcmNoLz9hcGk9MSZxdWVyeT00Ny41OTUxNTE4LC0xMjIuMzMxNjM5M1xuICAgIGdtYXBfc2VhcmNoOiB7XG4gICAgICBtYXRjaGVyOiAvKG1hcHNcXC4pP2dvb2dsZVxcLihbYS16XXsyLDN9KFxcLlthLXpdezJ9KT8pXFwvKG1hcHNcXC9zZWFyY2hcXC8pKC4qKS9pLFxuICAgICAgdHlwZTogXCJpZnJhbWVcIixcbiAgICAgIHVybDogZnVuY3Rpb24ocmV6KSB7XG4gICAgICAgIHJldHVybiBcIi8vbWFwcy5nb29nbGUuXCIgKyByZXpbMl0gKyBcIi9tYXBzP3E9XCIgKyByZXpbNV0ucmVwbGFjZShcInF1ZXJ5PVwiLCBcInE9XCIpLnJlcGxhY2UoXCJhcGk9MVwiLCBcIlwiKSArIFwiJm91dHB1dD1lbWJlZFwiO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAkKGRvY3VtZW50KS5vbihcIm9iamVjdE5lZWRzVHlwZS5mYlwiLCBmdW5jdGlvbihlLCBpbnN0YW5jZSwgaXRlbSkge1xuICAgIHZhciB1cmwgPSBpdGVtLnNyYyB8fCBcIlwiLFxuICAgICAgdHlwZSA9IGZhbHNlLFxuICAgICAgbWVkaWEsXG4gICAgICB0aHVtYixcbiAgICAgIHJleixcbiAgICAgIHBhcmFtcyxcbiAgICAgIHVybFBhcmFtcyxcbiAgICAgIHBhcmFtT2JqLFxuICAgICAgcHJvdmlkZXI7XG5cbiAgICBtZWRpYSA9ICQuZXh0ZW5kKHRydWUsIHt9LCBkZWZhdWx0cywgaXRlbS5vcHRzLm1lZGlhKTtcblxuICAgIC8vIExvb2sgZm9yIGFueSBtYXRjaGluZyBtZWRpYSB0eXBlXG4gICAgJC5lYWNoKG1lZGlhLCBmdW5jdGlvbihwcm92aWRlck5hbWUsIHByb3ZpZGVyT3B0cykge1xuICAgICAgcmV6ID0gdXJsLm1hdGNoKHByb3ZpZGVyT3B0cy5tYXRjaGVyKTtcblxuICAgICAgaWYgKCFyZXopIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0eXBlID0gcHJvdmlkZXJPcHRzLnR5cGU7XG4gICAgICBwcm92aWRlciA9IHByb3ZpZGVyTmFtZTtcbiAgICAgIHBhcmFtT2JqID0ge307XG5cbiAgICAgIGlmIChwcm92aWRlck9wdHMucGFyYW1QbGFjZSAmJiByZXpbcHJvdmlkZXJPcHRzLnBhcmFtUGxhY2VdKSB7XG4gICAgICAgIHVybFBhcmFtcyA9IHJleltwcm92aWRlck9wdHMucGFyYW1QbGFjZV07XG5cbiAgICAgICAgaWYgKHVybFBhcmFtc1swXSA9PSBcIj9cIikge1xuICAgICAgICAgIHVybFBhcmFtcyA9IHVybFBhcmFtcy5zdWJzdHJpbmcoMSk7XG4gICAgICAgIH1cblxuICAgICAgICB1cmxQYXJhbXMgPSB1cmxQYXJhbXMuc3BsaXQoXCImXCIpO1xuXG4gICAgICAgIGZvciAodmFyIG0gPSAwOyBtIDwgdXJsUGFyYW1zLmxlbmd0aDsgKyttKSB7XG4gICAgICAgICAgdmFyIHAgPSB1cmxQYXJhbXNbbV0uc3BsaXQoXCI9XCIsIDIpO1xuXG4gICAgICAgICAgaWYgKHAubGVuZ3RoID09IDIpIHtcbiAgICAgICAgICAgIHBhcmFtT2JqW3BbMF1dID0gZGVjb2RlVVJJQ29tcG9uZW50KHBbMV0ucmVwbGFjZSgvXFwrL2csIFwiIFwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHBhcmFtcyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBwcm92aWRlck9wdHMucGFyYW1zLCBpdGVtLm9wdHNbcHJvdmlkZXJOYW1lXSwgcGFyYW1PYmopO1xuXG4gICAgICB1cmwgPVxuICAgICAgICAkLnR5cGUocHJvdmlkZXJPcHRzLnVybCkgPT09IFwiZnVuY3Rpb25cIiA/IHByb3ZpZGVyT3B0cy51cmwuY2FsbCh0aGlzLCByZXosIHBhcmFtcywgaXRlbSkgOiBmb3JtYXQocHJvdmlkZXJPcHRzLnVybCwgcmV6LCBwYXJhbXMpO1xuXG4gICAgICB0aHVtYiA9XG4gICAgICAgICQudHlwZShwcm92aWRlck9wdHMudGh1bWIpID09PSBcImZ1bmN0aW9uXCIgPyBwcm92aWRlck9wdHMudGh1bWIuY2FsbCh0aGlzLCByZXosIHBhcmFtcywgaXRlbSkgOiBmb3JtYXQocHJvdmlkZXJPcHRzLnRodW1iLCByZXopO1xuXG4gICAgICBpZiAocHJvdmlkZXJOYW1lID09PSBcInlvdXR1YmVcIikge1xuICAgICAgICB1cmwgPSB1cmwucmVwbGFjZSgvJnQ9KChcXGQrKW0pPyhcXGQrKXMvLCBmdW5jdGlvbihtYXRjaCwgcDEsIG0sIHMpIHtcbiAgICAgICAgICByZXR1cm4gXCImc3RhcnQ9XCIgKyAoKG0gPyBwYXJzZUludChtLCAxMCkgKiA2MCA6IDApICsgcGFyc2VJbnQocywgMTApKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHByb3ZpZGVyTmFtZSA9PT0gXCJ2aW1lb1wiKSB7XG4gICAgICAgIHVybCA9IHVybC5yZXBsYWNlKFwiJiUyM1wiLCBcIiNcIik7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcblxuICAgIC8vIElmIGl0IGlzIGZvdW5kLCB0aGVuIGNoYW5nZSBjb250ZW50IHR5cGUgYW5kIHVwZGF0ZSB0aGUgdXJsXG5cbiAgICBpZiAodHlwZSkge1xuICAgICAgaWYgKCFpdGVtLm9wdHMudGh1bWIgJiYgIShpdGVtLm9wdHMuJHRodW1iICYmIGl0ZW0ub3B0cy4kdGh1bWIubGVuZ3RoKSkge1xuICAgICAgICBpdGVtLm9wdHMudGh1bWIgPSB0aHVtYjtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGUgPT09IFwiaWZyYW1lXCIpIHtcbiAgICAgICAgaXRlbS5vcHRzID0gJC5leHRlbmQodHJ1ZSwgaXRlbS5vcHRzLCB7XG4gICAgICAgICAgaWZyYW1lOiB7XG4gICAgICAgICAgICBwcmVsb2FkOiBmYWxzZSxcbiAgICAgICAgICAgIGF0dHI6IHtcbiAgICAgICAgICAgICAgc2Nyb2xsaW5nOiBcIm5vXCJcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAkLmV4dGVuZChpdGVtLCB7XG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIHNyYzogdXJsLFxuICAgICAgICBvcmlnU3JjOiBpdGVtLnNyYyxcbiAgICAgICAgY29udGVudFNvdXJjZTogcHJvdmlkZXIsXG4gICAgICAgIGNvbnRlbnRUeXBlOiB0eXBlID09PSBcImltYWdlXCIgPyBcImltYWdlXCIgOiBwcm92aWRlciA9PSBcImdtYXBfcGxhY2VcIiB8fCBwcm92aWRlciA9PSBcImdtYXBfc2VhcmNoXCIgPyBcIm1hcFwiIDogXCJ2aWRlb1wiXG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHVybCkge1xuICAgICAgaXRlbS50eXBlID0gaXRlbS5vcHRzLmRlZmF1bHRUeXBlO1xuICAgIH1cbiAgfSk7XG59KSh3aW5kb3cualF1ZXJ5IHx8IGpRdWVyeSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vL1xuLy8gR3Vlc3R1cmVzXG4vLyBBZGRzIHRvdWNoIGd1ZXN0dXJlcywgaGFuZGxlcyBjbGljayBhbmQgdGFwIGV2ZW50c1xuLy9cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4oZnVuY3Rpb24od2luZG93LCBkb2N1bWVudCwgJCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgcmVxdWVzdEFGcmFtZSA9IChmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxuICAgICAgd2luZG93LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxuICAgICAgd2luZG93Lm1velJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxuICAgICAgd2luZG93Lm9SZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICAgIC8vIGlmIGFsbCBlbHNlIGZhaWxzLCB1c2Ugc2V0VGltZW91dFxuICAgICAgZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5zZXRUaW1lb3V0KGNhbGxiYWNrLCAxMDAwIC8gNjApO1xuICAgICAgfVxuICAgICk7XG4gIH0pKCk7XG5cbiAgdmFyIGNhbmNlbEFGcmFtZSA9IChmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lIHx8XG4gICAgICB3aW5kb3cud2Via2l0Q2FuY2VsQW5pbWF0aW9uRnJhbWUgfHxcbiAgICAgIHdpbmRvdy5tb3pDYW5jZWxBbmltYXRpb25GcmFtZSB8fFxuICAgICAgd2luZG93Lm9DYW5jZWxBbmltYXRpb25GcmFtZSB8fFxuICAgICAgZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgd2luZG93LmNsZWFyVGltZW91dChpZCk7XG4gICAgICB9XG4gICAgKTtcbiAgfSkoKTtcblxuICB2YXIgZ2V0UG9pbnRlclhZID0gZnVuY3Rpb24oZSkge1xuICAgIHZhciByZXN1bHQgPSBbXTtcblxuICAgIGUgPSBlLm9yaWdpbmFsRXZlbnQgfHwgZSB8fCB3aW5kb3cuZTtcbiAgICBlID0gZS50b3VjaGVzICYmIGUudG91Y2hlcy5sZW5ndGggPyBlLnRvdWNoZXMgOiBlLmNoYW5nZWRUb3VjaGVzICYmIGUuY2hhbmdlZFRvdWNoZXMubGVuZ3RoID8gZS5jaGFuZ2VkVG91Y2hlcyA6IFtlXTtcblxuICAgIGZvciAodmFyIGtleSBpbiBlKSB7XG4gICAgICBpZiAoZVtrZXldLnBhZ2VYKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHtcbiAgICAgICAgICB4OiBlW2tleV0ucGFnZVgsXG4gICAgICAgICAgeTogZVtrZXldLnBhZ2VZXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChlW2tleV0uY2xpZW50WCkge1xuICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgeDogZVtrZXldLmNsaWVudFgsXG4gICAgICAgICAgeTogZVtrZXldLmNsaWVudFlcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICB2YXIgZGlzdGFuY2UgPSBmdW5jdGlvbihwb2ludDIsIHBvaW50MSwgd2hhdCkge1xuICAgIGlmICghcG9pbnQxIHx8ICFwb2ludDIpIHtcbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmICh3aGF0ID09PSBcInhcIikge1xuICAgICAgcmV0dXJuIHBvaW50Mi54IC0gcG9pbnQxLng7XG4gICAgfSBlbHNlIGlmICh3aGF0ID09PSBcInlcIikge1xuICAgICAgcmV0dXJuIHBvaW50Mi55IC0gcG9pbnQxLnk7XG4gICAgfVxuXG4gICAgcmV0dXJuIE1hdGguc3FydChNYXRoLnBvdyhwb2ludDIueCAtIHBvaW50MS54LCAyKSArIE1hdGgucG93KHBvaW50Mi55IC0gcG9pbnQxLnksIDIpKTtcbiAgfTtcblxuICB2YXIgaXNDbGlja2FibGUgPSBmdW5jdGlvbigkZWwpIHtcbiAgICBpZiAoXG4gICAgICAkZWwuaXMoJ2EsYXJlYSxidXR0b24sW3JvbGU9XCJidXR0b25cIl0saW5wdXQsbGFiZWwsc2VsZWN0LHN1bW1hcnksdGV4dGFyZWEsdmlkZW8sYXVkaW8nKSB8fFxuICAgICAgJC5pc0Z1bmN0aW9uKCRlbC5nZXQoMCkub25jbGljaykgfHxcbiAgICAgICRlbC5kYXRhKFwic2VsZWN0YWJsZVwiKVxuICAgICkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZm9yIGF0dHJpYnV0ZXMgbGlrZSBkYXRhLWZhbmN5Ym94LW5leHQgb3IgZGF0YS1mYW5jeWJveC1jbG9zZVxuICAgIGZvciAodmFyIGkgPSAwLCBhdHRzID0gJGVsWzBdLmF0dHJpYnV0ZXMsIG4gPSBhdHRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuICAgICAgaWYgKGF0dHNbaV0ubm9kZU5hbWUuc3Vic3RyKDAsIDE0KSA9PT0gXCJkYXRhLWZhbmN5Ym94LVwiKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfTtcblxuICB2YXIgaGFzU2Nyb2xsYmFycyA9IGZ1bmN0aW9uKGVsKSB7XG4gICAgdmFyIG92ZXJmbG93WSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsKVtcIm92ZXJmbG93LXlcIl0sXG4gICAgICBvdmVyZmxvd1ggPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbClbXCJvdmVyZmxvdy14XCJdLFxuICAgICAgdmVydGljYWwgPSAob3ZlcmZsb3dZID09PSBcInNjcm9sbFwiIHx8IG92ZXJmbG93WSA9PT0gXCJhdXRvXCIpICYmIGVsLnNjcm9sbEhlaWdodCA+IGVsLmNsaWVudEhlaWdodCxcbiAgICAgIGhvcml6b250YWwgPSAob3ZlcmZsb3dYID09PSBcInNjcm9sbFwiIHx8IG92ZXJmbG93WCA9PT0gXCJhdXRvXCIpICYmIGVsLnNjcm9sbFdpZHRoID4gZWwuY2xpZW50V2lkdGg7XG5cbiAgICByZXR1cm4gdmVydGljYWwgfHwgaG9yaXpvbnRhbDtcbiAgfTtcblxuICB2YXIgaXNTY3JvbGxhYmxlID0gZnVuY3Rpb24oJGVsKSB7XG4gICAgdmFyIHJleiA9IGZhbHNlO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIHJleiA9IGhhc1Njcm9sbGJhcnMoJGVsLmdldCgwKSk7XG5cbiAgICAgIGlmIChyZXopIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgICRlbCA9ICRlbC5wYXJlbnQoKTtcblxuICAgICAgaWYgKCEkZWwubGVuZ3RoIHx8ICRlbC5oYXNDbGFzcyhcImZhbmN5Ym94LXN0YWdlXCIpIHx8ICRlbC5pcyhcImJvZHlcIikpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlejtcbiAgfTtcblxuICB2YXIgR3Vlc3R1cmVzID0gZnVuY3Rpb24oaW5zdGFuY2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBzZWxmLmluc3RhbmNlID0gaW5zdGFuY2U7XG5cbiAgICBzZWxmLiRiZyA9IGluc3RhbmNlLiRyZWZzLmJnO1xuICAgIHNlbGYuJHN0YWdlID0gaW5zdGFuY2UuJHJlZnMuc3RhZ2U7XG4gICAgc2VsZi4kY29udGFpbmVyID0gaW5zdGFuY2UuJHJlZnMuY29udGFpbmVyO1xuXG4gICAgc2VsZi5kZXN0cm95KCk7XG5cbiAgICBzZWxmLiRjb250YWluZXIub24oXCJ0b3VjaHN0YXJ0LmZiLnRvdWNoIG1vdXNlZG93bi5mYi50b3VjaFwiLCAkLnByb3h5KHNlbGYsIFwib250b3VjaHN0YXJ0XCIpKTtcbiAgfTtcblxuICBHdWVzdHVyZXMucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLiRjb250YWluZXIub2ZmKFwiLmZiLnRvdWNoXCIpO1xuICB9O1xuXG4gIEd1ZXN0dXJlcy5wcm90b3R5cGUub250b3VjaHN0YXJ0ID0gZnVuY3Rpb24oZSkge1xuICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICR0YXJnZXQgPSAkKGUudGFyZ2V0KSxcbiAgICAgIGluc3RhbmNlID0gc2VsZi5pbnN0YW5jZSxcbiAgICAgIGN1cnJlbnQgPSBpbnN0YW5jZS5jdXJyZW50LFxuICAgICAgJGNvbnRlbnQgPSBjdXJyZW50LiRjb250ZW50LFxuICAgICAgaXNUb3VjaERldmljZSA9IGUudHlwZSA9PSBcInRvdWNoc3RhcnRcIjtcblxuICAgIC8vIERvIG5vdCByZXNwb25kIHRvIGJvdGggKHRvdWNoIGFuZCBtb3VzZSkgZXZlbnRzXG4gICAgaWYgKGlzVG91Y2hEZXZpY2UpIHtcbiAgICAgIHNlbGYuJGNvbnRhaW5lci5vZmYoXCJtb3VzZWRvd24uZmIudG91Y2hcIik7XG4gICAgfVxuXG4gICAgLy8gSWdub3JlIHJpZ2h0IGNsaWNrXG4gICAgaWYgKGUub3JpZ2luYWxFdmVudCAmJiBlLm9yaWdpbmFsRXZlbnQuYnV0dG9uID09IDIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJZ25vcmUgdGFwaW5nIG9uIGxpbmtzLCBidXR0b25zLCBpbnB1dCBlbGVtZW50c1xuICAgIGlmICghJHRhcmdldC5sZW5ndGggfHwgaXNDbGlja2FibGUoJHRhcmdldCkgfHwgaXNDbGlja2FibGUoJHRhcmdldC5wYXJlbnQoKSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJZ25vcmUgY2xpY2tzIG9uIHRoZSBzY3JvbGxiYXJcbiAgICBpZiAoISR0YXJnZXQuaXMoXCJpbWdcIikgJiYgZS5vcmlnaW5hbEV2ZW50LmNsaWVudFggPiAkdGFyZ2V0WzBdLmNsaWVudFdpZHRoICsgJHRhcmdldC5vZmZzZXQoKS5sZWZ0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gSWdub3JlIGNsaWNrcyB3aGlsZSB6b29taW5nIG9yIGNsb3NpbmdcbiAgICBpZiAoIWN1cnJlbnQgfHwgaW5zdGFuY2UuaXNBbmltYXRpbmcgfHwgaW5zdGFuY2UuaXNDbG9zaW5nKSB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2VsZi5yZWFsUG9pbnRzID0gc2VsZi5zdGFydFBvaW50cyA9IGdldFBvaW50ZXJYWShlKTtcblxuICAgIGlmICghc2VsZi5zdGFydFBvaW50cy5sZW5ndGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgc2VsZi5zdGFydEV2ZW50ID0gZTtcblxuICAgIHNlbGYuY2FuVGFwID0gdHJ1ZTtcbiAgICBzZWxmLiR0YXJnZXQgPSAkdGFyZ2V0O1xuICAgIHNlbGYuJGNvbnRlbnQgPSAkY29udGVudDtcbiAgICBzZWxmLm9wdHMgPSBjdXJyZW50Lm9wdHMudG91Y2g7XG5cbiAgICBzZWxmLmlzUGFubmluZyA9IGZhbHNlO1xuICAgIHNlbGYuaXNTd2lwaW5nID0gZmFsc2U7XG4gICAgc2VsZi5pc1pvb21pbmcgPSBmYWxzZTtcbiAgICBzZWxmLmlzU2Nyb2xsaW5nID0gZmFsc2U7XG5cbiAgICBzZWxmLnN0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIHNlbGYuZGlzdGFuY2VYID0gc2VsZi5kaXN0YW5jZVkgPSBzZWxmLmRpc3RhbmNlID0gMDtcblxuICAgIHNlbGYuY2FudmFzV2lkdGggPSBNYXRoLnJvdW5kKGN1cnJlbnQuJHNsaWRlWzBdLmNsaWVudFdpZHRoKTtcbiAgICBzZWxmLmNhbnZhc0hlaWdodCA9IE1hdGgucm91bmQoY3VycmVudC4kc2xpZGVbMF0uY2xpZW50SGVpZ2h0KTtcblxuICAgIHNlbGYuY29udGVudExhc3RQb3MgPSBudWxsO1xuICAgIHNlbGYuY29udGVudFN0YXJ0UG9zID0gJC5mYW5jeWJveC5nZXRUcmFuc2xhdGUoc2VsZi4kY29udGVudCkgfHwge3RvcDogMCwgbGVmdDogMH07XG4gICAgc2VsZi5zbGlkZXJTdGFydFBvcyA9IHNlbGYuc2xpZGVyTGFzdFBvcyB8fCAkLmZhbmN5Ym94LmdldFRyYW5zbGF0ZShjdXJyZW50LiRzbGlkZSk7XG5cbiAgICAvLyBTaW5jZSBwb3NpdGlvbiB3aWxsIGJlIGFic29sdXRlLCBidXQgd2UgbmVlZCB0byBtYWtlIGl0IHJlbGF0aXZlIHRvIHRoZSBzdGFnZVxuICAgIHNlbGYuc3RhZ2VQb3MgPSAkLmZhbmN5Ym94LmdldFRyYW5zbGF0ZShpbnN0YW5jZS4kcmVmcy5zdGFnZSk7XG5cbiAgICBzZWxmLnNsaWRlclN0YXJ0UG9zLnRvcCAtPSBzZWxmLnN0YWdlUG9zLnRvcDtcbiAgICBzZWxmLnNsaWRlclN0YXJ0UG9zLmxlZnQgLT0gc2VsZi5zdGFnZVBvcy5sZWZ0O1xuXG4gICAgc2VsZi5jb250ZW50U3RhcnRQb3MudG9wIC09IHNlbGYuc3RhZ2VQb3MudG9wO1xuICAgIHNlbGYuY29udGVudFN0YXJ0UG9zLmxlZnQgLT0gc2VsZi5zdGFnZVBvcy5sZWZ0O1xuXG4gICAgJChkb2N1bWVudClcbiAgICAgIC5vZmYoXCIuZmIudG91Y2hcIilcbiAgICAgIC5vbihpc1RvdWNoRGV2aWNlID8gXCJ0b3VjaGVuZC5mYi50b3VjaCB0b3VjaGNhbmNlbC5mYi50b3VjaFwiIDogXCJtb3VzZXVwLmZiLnRvdWNoIG1vdXNlbGVhdmUuZmIudG91Y2hcIiwgJC5wcm94eShzZWxmLCBcIm9udG91Y2hlbmRcIikpXG4gICAgICAub24oaXNUb3VjaERldmljZSA/IFwidG91Y2htb3ZlLmZiLnRvdWNoXCIgOiBcIm1vdXNlbW92ZS5mYi50b3VjaFwiLCAkLnByb3h5KHNlbGYsIFwib250b3VjaG1vdmVcIikpO1xuXG4gICAgaWYgKCQuZmFuY3lib3guaXNNb2JpbGUpIHtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgc2VsZi5vbnNjcm9sbCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKCEoc2VsZi5vcHRzIHx8IGluc3RhbmNlLmNhblBhbigpKSB8fCAhKCR0YXJnZXQuaXMoc2VsZi4kc3RhZ2UpIHx8IHNlbGYuJHN0YWdlLmZpbmQoJHRhcmdldCkubGVuZ3RoKSkge1xuICAgICAgaWYgKCR0YXJnZXQuaXMoXCIuZmFuY3lib3gtaW1hZ2VcIikpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCEoJC5mYW5jeWJveC5pc01vYmlsZSAmJiAoaXNTY3JvbGxhYmxlKCR0YXJnZXQpIHx8IGlzU2Nyb2xsYWJsZSgkdGFyZ2V0LnBhcmVudCgpKSkpKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuc3RhcnRQb2ludHMubGVuZ3RoID09PSAxIHx8IGN1cnJlbnQuaGFzRXJyb3IpIHtcbiAgICAgIGlmIChzZWxmLmluc3RhbmNlLmNhblBhbigpKSB7XG4gICAgICAgICQuZmFuY3lib3guc3RvcChzZWxmLiRjb250ZW50KTtcblxuICAgICAgICBzZWxmLiRjb250ZW50LmNzcyhcInRyYW5zaXRpb24tZHVyYXRpb25cIiwgXCJcIik7XG5cbiAgICAgICAgc2VsZi5pc1Bhbm5pbmcgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi5pc1N3aXBpbmcgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBzZWxmLiRjb250YWluZXIuYWRkQ2xhc3MoXCJmYW5jeWJveC1jb250cm9scy0taXNHcmFiYmluZ1wiKTtcbiAgICB9XG5cbiAgICBpZiAoc2VsZi5zdGFydFBvaW50cy5sZW5ndGggPT09IDIgJiYgY3VycmVudC50eXBlID09PSBcImltYWdlXCIgJiYgKGN1cnJlbnQuaXNMb2FkZWQgfHwgY3VycmVudC4kZ2hvc3QpKSB7XG4gICAgICBzZWxmLmNhblRhcCA9IGZhbHNlO1xuICAgICAgc2VsZi5pc1N3aXBpbmcgPSBmYWxzZTtcbiAgICAgIHNlbGYuaXNQYW5uaW5nID0gZmFsc2U7XG5cbiAgICAgIHNlbGYuaXNab29taW5nID0gdHJ1ZTtcblxuICAgICAgJC5mYW5jeWJveC5zdG9wKHNlbGYuJGNvbnRlbnQpO1xuXG4gICAgICBzZWxmLiRjb250ZW50LmNzcyhcInRyYW5zaXRpb24tZHVyYXRpb25cIiwgXCJcIik7XG5cbiAgICAgIHNlbGYuY2VudGVyUG9pbnRTdGFydFggPSAoc2VsZi5zdGFydFBvaW50c1swXS54ICsgc2VsZi5zdGFydFBvaW50c1sxXS54KSAqIDAuNSAtICQod2luZG93KS5zY3JvbGxMZWZ0KCk7XG4gICAgICBzZWxmLmNlbnRlclBvaW50U3RhcnRZID0gKHNlbGYuc3RhcnRQb2ludHNbMF0ueSArIHNlbGYuc3RhcnRQb2ludHNbMV0ueSkgKiAwLjUgLSAkKHdpbmRvdykuc2Nyb2xsVG9wKCk7XG5cbiAgICAgIHNlbGYucGVyY2VudGFnZU9mSW1hZ2VBdFBpbmNoUG9pbnRYID0gKHNlbGYuY2VudGVyUG9pbnRTdGFydFggLSBzZWxmLmNvbnRlbnRTdGFydFBvcy5sZWZ0KSAvIHNlbGYuY29udGVudFN0YXJ0UG9zLndpZHRoO1xuICAgICAgc2VsZi5wZXJjZW50YWdlT2ZJbWFnZUF0UGluY2hQb2ludFkgPSAoc2VsZi5jZW50ZXJQb2ludFN0YXJ0WSAtIHNlbGYuY29udGVudFN0YXJ0UG9zLnRvcCkgLyBzZWxmLmNvbnRlbnRTdGFydFBvcy5oZWlnaHQ7XG5cbiAgICAgIHNlbGYuc3RhcnREaXN0YW5jZUJldHdlZW5GaW5nZXJzID0gZGlzdGFuY2Uoc2VsZi5zdGFydFBvaW50c1swXSwgc2VsZi5zdGFydFBvaW50c1sxXSk7XG4gICAgfVxuICB9O1xuXG4gIEd1ZXN0dXJlcy5wcm90b3R5cGUub25zY3JvbGwgPSBmdW5jdGlvbihlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgc2VsZi5pc1Njcm9sbGluZyA9IHRydWU7XG5cbiAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsIHNlbGYub25zY3JvbGwsIHRydWUpO1xuICB9O1xuXG4gIEd1ZXN0dXJlcy5wcm90b3R5cGUub250b3VjaG1vdmUgPSBmdW5jdGlvbihlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgJHRhcmdldCA9ICQoZS50YXJnZXQpO1xuXG4gICAgLy8gTWFrZSBzdXJlIHVzZXIgaGFzIG5vdCByZWxlYXNlZCBvdmVyIGlmcmFtZSBvciBkaXNhYmxlZCBlbGVtZW50XG4gICAgaWYgKGUub3JpZ2luYWxFdmVudC5idXR0b25zICE9PSB1bmRlZmluZWQgJiYgZS5vcmlnaW5hbEV2ZW50LmJ1dHRvbnMgPT09IDApIHtcbiAgICAgIHNlbGYub250b3VjaGVuZChlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2VsZi5pc1Njcm9sbGluZyB8fCAhKCR0YXJnZXQuaXMoc2VsZi4kc3RhZ2UpIHx8IHNlbGYuJHN0YWdlLmZpbmQoJHRhcmdldCkubGVuZ3RoKSkge1xuICAgICAgc2VsZi5jYW5UYXAgPSBmYWxzZTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGYubmV3UG9pbnRzID0gZ2V0UG9pbnRlclhZKGUpO1xuXG4gICAgaWYgKCEoc2VsZi5vcHRzIHx8IHNlbGYuaW5zdGFuY2UuY2FuUGFuKCkpIHx8ICFzZWxmLm5ld1BvaW50cy5sZW5ndGggfHwgIXNlbGYubmV3UG9pbnRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghKHNlbGYuaXNTd2lwaW5nICYmIHNlbGYuaXNTd2lwaW5nID09PSB0cnVlKSkge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cblxuICAgIHNlbGYuZGlzdGFuY2VYID0gZGlzdGFuY2Uoc2VsZi5uZXdQb2ludHNbMF0sIHNlbGYuc3RhcnRQb2ludHNbMF0sIFwieFwiKTtcbiAgICBzZWxmLmRpc3RhbmNlWSA9IGRpc3RhbmNlKHNlbGYubmV3UG9pbnRzWzBdLCBzZWxmLnN0YXJ0UG9pbnRzWzBdLCBcInlcIik7XG5cbiAgICBzZWxmLmRpc3RhbmNlID0gZGlzdGFuY2Uoc2VsZi5uZXdQb2ludHNbMF0sIHNlbGYuc3RhcnRQb2ludHNbMF0pO1xuXG4gICAgLy8gU2tpcCBmYWxzZSBvbnRvdWNobW92ZSBldmVudHMgKENocm9tZSlcbiAgICBpZiAoc2VsZi5kaXN0YW5jZSA+IDApIHtcbiAgICAgIGlmIChzZWxmLmlzU3dpcGluZykge1xuICAgICAgICBzZWxmLm9uU3dpcGUoZSk7XG4gICAgICB9IGVsc2UgaWYgKHNlbGYuaXNQYW5uaW5nKSB7XG4gICAgICAgIHNlbGYub25QYW4oKTtcbiAgICAgIH0gZWxzZSBpZiAoc2VsZi5pc1pvb21pbmcpIHtcbiAgICAgICAgc2VsZi5vblpvb20oKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgR3Vlc3R1cmVzLnByb3RvdHlwZS5vblN3aXBlID0gZnVuY3Rpb24oZSkge1xuICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgIHN3aXBpbmcgPSBzZWxmLmlzU3dpcGluZyxcbiAgICAgIGxlZnQgPSBzZWxmLnNsaWRlclN0YXJ0UG9zLmxlZnQgfHwgMCxcbiAgICAgIGFuZ2xlO1xuXG4gICAgLy8gSWYgZGlyZWN0aW9uIGlzIG5vdCB5ZXQgZGV0ZXJtaW5lZFxuICAgIGlmIChzd2lwaW5nID09PSB0cnVlKSB7XG4gICAgICAvLyBXZSBuZWVkIGF0IGxlYXN0IDEwcHggZGlzdGFuY2UgdG8gY29ycmVjdGx5IGNhbGN1bGF0ZSBhbiBhbmdsZVxuICAgICAgaWYgKE1hdGguYWJzKHNlbGYuZGlzdGFuY2UpID4gMTApIHtcbiAgICAgICAgc2VsZi5jYW5UYXAgPSBmYWxzZTtcblxuICAgICAgICBpZiAoc2VsZi5pbnN0YW5jZS5ncm91cC5sZW5ndGggPCAyICYmIHNlbGYub3B0cy52ZXJ0aWNhbCkge1xuICAgICAgICAgIHNlbGYuaXNTd2lwaW5nID0gXCJ5XCI7XG4gICAgICAgIH0gZWxzZSBpZiAoc2VsZi5pbnN0YW5jZS5pc0RyYWdnaW5nIHx8IHNlbGYub3B0cy52ZXJ0aWNhbCA9PT0gZmFsc2UgfHwgKHNlbGYub3B0cy52ZXJ0aWNhbCA9PT0gXCJhdXRvXCIgJiYgJCh3aW5kb3cpLndpZHRoKCkgPiA4MDApKSB7XG4gICAgICAgICAgc2VsZi5pc1N3aXBpbmcgPSBcInhcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhbmdsZSA9IE1hdGguYWJzKE1hdGguYXRhbjIoc2VsZi5kaXN0YW5jZVksIHNlbGYuZGlzdGFuY2VYKSAqIDE4MCAvIE1hdGguUEkpO1xuXG4gICAgICAgICAgc2VsZi5pc1N3aXBpbmcgPSBhbmdsZSA+IDQ1ICYmIGFuZ2xlIDwgMTM1ID8gXCJ5XCIgOiBcInhcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuY2FuVGFwID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHNlbGYuaXNTd2lwaW5nID09PSBcInlcIiAmJiAkLmZhbmN5Ym94LmlzTW9iaWxlICYmIChpc1Njcm9sbGFibGUoc2VsZi4kdGFyZ2V0KSB8fCBpc1Njcm9sbGFibGUoc2VsZi4kdGFyZ2V0LnBhcmVudCgpKSkpIHtcbiAgICAgICAgICBzZWxmLmlzU2Nyb2xsaW5nID0gdHJ1ZTtcblxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYuaW5zdGFuY2UuaXNEcmFnZ2luZyA9IHNlbGYuaXNTd2lwaW5nO1xuXG4gICAgICAgIC8vIFJlc2V0IHBvaW50cyB0byBhdm9pZCBqdW1waW5nLCBiZWNhdXNlIHdlIGRyb3BwZWQgZmlyc3Qgc3dpcGVzIHRvIGNhbGN1bGF0ZSB0aGUgYW5nbGVcbiAgICAgICAgc2VsZi5zdGFydFBvaW50cyA9IHNlbGYubmV3UG9pbnRzO1xuXG4gICAgICAgICQuZWFjaChzZWxmLmluc3RhbmNlLnNsaWRlcywgZnVuY3Rpb24oaW5kZXgsIHNsaWRlKSB7XG4gICAgICAgICAgJC5mYW5jeWJveC5zdG9wKHNsaWRlLiRzbGlkZSk7XG5cbiAgICAgICAgICBzbGlkZS4kc2xpZGUuY3NzKFwidHJhbnNpdGlvbi1kdXJhdGlvblwiLCBcIlwiKTtcblxuICAgICAgICAgIHNsaWRlLmluVHJhbnNpdGlvbiA9IGZhbHNlO1xuXG4gICAgICAgICAgaWYgKHNsaWRlLnBvcyA9PT0gc2VsZi5pbnN0YW5jZS5jdXJyZW50LnBvcykge1xuICAgICAgICAgICAgc2VsZi5zbGlkZXJTdGFydFBvcy5sZWZ0ID0gJC5mYW5jeWJveC5nZXRUcmFuc2xhdGUoc2xpZGUuJHNsaWRlKS5sZWZ0IC0gJC5mYW5jeWJveC5nZXRUcmFuc2xhdGUoc2VsZi5pbnN0YW5jZS4kcmVmcy5zdGFnZSkubGVmdDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFN0b3Agc2xpZGVzaG93XG4gICAgICAgIGlmIChzZWxmLmluc3RhbmNlLlNsaWRlU2hvdyAmJiBzZWxmLmluc3RhbmNlLlNsaWRlU2hvdy5pc0FjdGl2ZSkge1xuICAgICAgICAgIHNlbGYuaW5zdGFuY2UuU2xpZGVTaG93LnN0b3AoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gU3RpY2t5IGVkZ2VzXG4gICAgaWYgKHN3aXBpbmcgPT0gXCJ4XCIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgc2VsZi5kaXN0YW5jZVggPiAwICYmXG4gICAgICAgIChzZWxmLmluc3RhbmNlLmdyb3VwLmxlbmd0aCA8IDIgfHwgKHNlbGYuaW5zdGFuY2UuY3VycmVudC5pbmRleCA9PT0gMCAmJiAhc2VsZi5pbnN0YW5jZS5jdXJyZW50Lm9wdHMubG9vcCkpXG4gICAgICApIHtcbiAgICAgICAgbGVmdCA9IGxlZnQgKyBNYXRoLnBvdyhzZWxmLmRpc3RhbmNlWCwgMC44KTtcbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHNlbGYuZGlzdGFuY2VYIDwgMCAmJlxuICAgICAgICAoc2VsZi5pbnN0YW5jZS5ncm91cC5sZW5ndGggPCAyIHx8XG4gICAgICAgICAgKHNlbGYuaW5zdGFuY2UuY3VycmVudC5pbmRleCA9PT0gc2VsZi5pbnN0YW5jZS5ncm91cC5sZW5ndGggLSAxICYmICFzZWxmLmluc3RhbmNlLmN1cnJlbnQub3B0cy5sb29wKSlcbiAgICAgICkge1xuICAgICAgICBsZWZ0ID0gbGVmdCAtIE1hdGgucG93KC1zZWxmLmRpc3RhbmNlWCwgMC44KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxlZnQgPSBsZWZ0ICsgc2VsZi5kaXN0YW5jZVg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZi5zbGlkZXJMYXN0UG9zID0ge1xuICAgICAgdG9wOiBzd2lwaW5nID09IFwieFwiID8gMCA6IHNlbGYuc2xpZGVyU3RhcnRQb3MudG9wICsgc2VsZi5kaXN0YW5jZVksXG4gICAgICBsZWZ0OiBsZWZ0XG4gICAgfTtcblxuICAgIGlmIChzZWxmLnJlcXVlc3RJZCkge1xuICAgICAgY2FuY2VsQUZyYW1lKHNlbGYucmVxdWVzdElkKTtcblxuICAgICAgc2VsZi5yZXF1ZXN0SWQgPSBudWxsO1xuICAgIH1cblxuICAgIHNlbGYucmVxdWVzdElkID0gcmVxdWVzdEFGcmFtZShmdW5jdGlvbigpIHtcbiAgICAgIGlmIChzZWxmLnNsaWRlckxhc3RQb3MpIHtcbiAgICAgICAgJC5lYWNoKHNlbGYuaW5zdGFuY2Uuc2xpZGVzLCBmdW5jdGlvbihpbmRleCwgc2xpZGUpIHtcbiAgICAgICAgICB2YXIgcG9zID0gc2xpZGUucG9zIC0gc2VsZi5pbnN0YW5jZS5jdXJyUG9zO1xuXG4gICAgICAgICAgJC5mYW5jeWJveC5zZXRUcmFuc2xhdGUoc2xpZGUuJHNsaWRlLCB7XG4gICAgICAgICAgICB0b3A6IHNlbGYuc2xpZGVyTGFzdFBvcy50b3AsXG4gICAgICAgICAgICBsZWZ0OiBzZWxmLnNsaWRlckxhc3RQb3MubGVmdCArIHBvcyAqIHNlbGYuY2FudmFzV2lkdGggKyBwb3MgKiBzbGlkZS5vcHRzLmd1dHRlclxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICBzZWxmLiRjb250YWluZXIuYWRkQ2xhc3MoXCJmYW5jeWJveC1pcy1zbGlkaW5nXCIpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIEd1ZXN0dXJlcy5wcm90b3R5cGUub25QYW4gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBQcmV2ZW50IGFjY2lkZW50YWwgbW92ZW1lbnQgKHNvbWV0aW1lcywgd2hlbiB0YXBwaW5nIGNhc3VhbGx5LCBmaW5nZXIgY2FuIG1vdmUgYSBiaXQpXG4gICAgaWYgKGRpc3RhbmNlKHNlbGYubmV3UG9pbnRzWzBdLCBzZWxmLnJlYWxQb2ludHNbMF0pIDwgKCQuZmFuY3lib3guaXNNb2JpbGUgPyAxMCA6IDUpKSB7XG4gICAgICBzZWxmLnN0YXJ0UG9pbnRzID0gc2VsZi5uZXdQb2ludHM7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2VsZi5jYW5UYXAgPSBmYWxzZTtcblxuICAgIHNlbGYuY29udGVudExhc3RQb3MgPSBzZWxmLmxpbWl0TW92ZW1lbnQoKTtcblxuICAgIGlmIChzZWxmLnJlcXVlc3RJZCkge1xuICAgICAgY2FuY2VsQUZyYW1lKHNlbGYucmVxdWVzdElkKTtcblxuICAgICAgc2VsZi5yZXF1ZXN0SWQgPSBudWxsO1xuICAgIH1cblxuICAgIHNlbGYucmVxdWVzdElkID0gcmVxdWVzdEFGcmFtZShmdW5jdGlvbigpIHtcbiAgICAgICQuZmFuY3lib3guc2V0VHJhbnNsYXRlKHNlbGYuJGNvbnRlbnQsIHNlbGYuY29udGVudExhc3RQb3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIE1ha2UgcGFubmluZyBzdGlja3kgdG8gdGhlIGVkZ2VzXG4gIEd1ZXN0dXJlcy5wcm90b3R5cGUubGltaXRNb3ZlbWVudCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBjYW52YXNXaWR0aCA9IHNlbGYuY2FudmFzV2lkdGg7XG4gICAgdmFyIGNhbnZhc0hlaWdodCA9IHNlbGYuY2FudmFzSGVpZ2h0O1xuXG4gICAgdmFyIGRpc3RhbmNlWCA9IHNlbGYuZGlzdGFuY2VYO1xuICAgIHZhciBkaXN0YW5jZVkgPSBzZWxmLmRpc3RhbmNlWTtcblxuICAgIHZhciBjb250ZW50U3RhcnRQb3MgPSBzZWxmLmNvbnRlbnRTdGFydFBvcztcblxuICAgIHZhciBjdXJyZW50T2Zmc2V0WCA9IGNvbnRlbnRTdGFydFBvcy5sZWZ0O1xuICAgIHZhciBjdXJyZW50T2Zmc2V0WSA9IGNvbnRlbnRTdGFydFBvcy50b3A7XG5cbiAgICB2YXIgY3VycmVudFdpZHRoID0gY29udGVudFN0YXJ0UG9zLndpZHRoO1xuICAgIHZhciBjdXJyZW50SGVpZ2h0ID0gY29udGVudFN0YXJ0UG9zLmhlaWdodDtcblxuICAgIHZhciBtaW5UcmFuc2xhdGVYLCBtaW5UcmFuc2xhdGVZLCBtYXhUcmFuc2xhdGVYLCBtYXhUcmFuc2xhdGVZLCBuZXdPZmZzZXRYLCBuZXdPZmZzZXRZO1xuXG4gICAgaWYgKGN1cnJlbnRXaWR0aCA+IGNhbnZhc1dpZHRoKSB7XG4gICAgICBuZXdPZmZzZXRYID0gY3VycmVudE9mZnNldFggKyBkaXN0YW5jZVg7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld09mZnNldFggPSBjdXJyZW50T2Zmc2V0WDtcbiAgICB9XG5cbiAgICBuZXdPZmZzZXRZID0gY3VycmVudE9mZnNldFkgKyBkaXN0YW5jZVk7XG5cbiAgICAvLyBTbG93IGRvd24gcHJvcG9ydGlvbmFsbHkgdG8gdHJhdmVsZWQgZGlzdGFuY2VcbiAgICBtaW5UcmFuc2xhdGVYID0gTWF0aC5tYXgoMCwgY2FudmFzV2lkdGggKiAwLjUgLSBjdXJyZW50V2lkdGggKiAwLjUpO1xuICAgIG1pblRyYW5zbGF0ZVkgPSBNYXRoLm1heCgwLCBjYW52YXNIZWlnaHQgKiAwLjUgLSBjdXJyZW50SGVpZ2h0ICogMC41KTtcblxuICAgIG1heFRyYW5zbGF0ZVggPSBNYXRoLm1pbihjYW52YXNXaWR0aCAtIGN1cnJlbnRXaWR0aCwgY2FudmFzV2lkdGggKiAwLjUgLSBjdXJyZW50V2lkdGggKiAwLjUpO1xuICAgIG1heFRyYW5zbGF0ZVkgPSBNYXRoLm1pbihjYW52YXNIZWlnaHQgLSBjdXJyZW50SGVpZ2h0LCBjYW52YXNIZWlnaHQgKiAwLjUgLSBjdXJyZW50SGVpZ2h0ICogMC41KTtcblxuICAgIC8vICAgLT5cbiAgICBpZiAoZGlzdGFuY2VYID4gMCAmJiBuZXdPZmZzZXRYID4gbWluVHJhbnNsYXRlWCkge1xuICAgICAgbmV3T2Zmc2V0WCA9IG1pblRyYW5zbGF0ZVggLSAxICsgTWF0aC5wb3coLW1pblRyYW5zbGF0ZVggKyBjdXJyZW50T2Zmc2V0WCArIGRpc3RhbmNlWCwgMC44KSB8fCAwO1xuICAgIH1cblxuICAgIC8vICAgIDwtXG4gICAgaWYgKGRpc3RhbmNlWCA8IDAgJiYgbmV3T2Zmc2V0WCA8IG1heFRyYW5zbGF0ZVgpIHtcbiAgICAgIG5ld09mZnNldFggPSBtYXhUcmFuc2xhdGVYICsgMSAtIE1hdGgucG93KG1heFRyYW5zbGF0ZVggLSBjdXJyZW50T2Zmc2V0WCAtIGRpc3RhbmNlWCwgMC44KSB8fCAwO1xuICAgIH1cblxuICAgIC8vICAgXFwvXG4gICAgaWYgKGRpc3RhbmNlWSA+IDAgJiYgbmV3T2Zmc2V0WSA+IG1pblRyYW5zbGF0ZVkpIHtcbiAgICAgIG5ld09mZnNldFkgPSBtaW5UcmFuc2xhdGVZIC0gMSArIE1hdGgucG93KC1taW5UcmFuc2xhdGVZICsgY3VycmVudE9mZnNldFkgKyBkaXN0YW5jZVksIDAuOCkgfHwgMDtcbiAgICB9XG5cbiAgICAvLyAgIC9cXFxuICAgIGlmIChkaXN0YW5jZVkgPCAwICYmIG5ld09mZnNldFkgPCBtYXhUcmFuc2xhdGVZKSB7XG4gICAgICBuZXdPZmZzZXRZID0gbWF4VHJhbnNsYXRlWSArIDEgLSBNYXRoLnBvdyhtYXhUcmFuc2xhdGVZIC0gY3VycmVudE9mZnNldFkgLSBkaXN0YW5jZVksIDAuOCkgfHwgMDtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG9wOiBuZXdPZmZzZXRZLFxuICAgICAgbGVmdDogbmV3T2Zmc2V0WFxuICAgIH07XG4gIH07XG5cbiAgR3Vlc3R1cmVzLnByb3RvdHlwZS5saW1pdFBvc2l0aW9uID0gZnVuY3Rpb24obmV3T2Zmc2V0WCwgbmV3T2Zmc2V0WSwgbmV3V2lkdGgsIG5ld0hlaWdodCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBjYW52YXNXaWR0aCA9IHNlbGYuY2FudmFzV2lkdGg7XG4gICAgdmFyIGNhbnZhc0hlaWdodCA9IHNlbGYuY2FudmFzSGVpZ2h0O1xuXG4gICAgaWYgKG5ld1dpZHRoID4gY2FudmFzV2lkdGgpIHtcbiAgICAgIG5ld09mZnNldFggPSBuZXdPZmZzZXRYID4gMCA/IDAgOiBuZXdPZmZzZXRYO1xuICAgICAgbmV3T2Zmc2V0WCA9IG5ld09mZnNldFggPCBjYW52YXNXaWR0aCAtIG5ld1dpZHRoID8gY2FudmFzV2lkdGggLSBuZXdXaWR0aCA6IG5ld09mZnNldFg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENlbnRlciBob3Jpem9udGFsbHlcbiAgICAgIG5ld09mZnNldFggPSBNYXRoLm1heCgwLCBjYW52YXNXaWR0aCAvIDIgLSBuZXdXaWR0aCAvIDIpO1xuICAgIH1cblxuICAgIGlmIChuZXdIZWlnaHQgPiBjYW52YXNIZWlnaHQpIHtcbiAgICAgIG5ld09mZnNldFkgPSBuZXdPZmZzZXRZID4gMCA/IDAgOiBuZXdPZmZzZXRZO1xuICAgICAgbmV3T2Zmc2V0WSA9IG5ld09mZnNldFkgPCBjYW52YXNIZWlnaHQgLSBuZXdIZWlnaHQgPyBjYW52YXNIZWlnaHQgLSBuZXdIZWlnaHQgOiBuZXdPZmZzZXRZO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBDZW50ZXIgdmVydGljYWxseVxuICAgICAgbmV3T2Zmc2V0WSA9IE1hdGgubWF4KDAsIGNhbnZhc0hlaWdodCAvIDIgLSBuZXdIZWlnaHQgLyAyKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG9wOiBuZXdPZmZzZXRZLFxuICAgICAgbGVmdDogbmV3T2Zmc2V0WFxuICAgIH07XG4gIH07XG5cbiAgR3Vlc3R1cmVzLnByb3RvdHlwZS5vblpvb20gPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBDYWxjdWxhdGUgY3VycmVudCBkaXN0YW5jZSBiZXR3ZWVuIHBvaW50cyB0byBnZXQgcGluY2ggcmF0aW8gYW5kIG5ldyB3aWR0aCBhbmQgaGVpZ2h0XG4gICAgdmFyIGNvbnRlbnRTdGFydFBvcyA9IHNlbGYuY29udGVudFN0YXJ0UG9zO1xuXG4gICAgdmFyIGN1cnJlbnRXaWR0aCA9IGNvbnRlbnRTdGFydFBvcy53aWR0aDtcbiAgICB2YXIgY3VycmVudEhlaWdodCA9IGNvbnRlbnRTdGFydFBvcy5oZWlnaHQ7XG5cbiAgICB2YXIgY3VycmVudE9mZnNldFggPSBjb250ZW50U3RhcnRQb3MubGVmdDtcbiAgICB2YXIgY3VycmVudE9mZnNldFkgPSBjb250ZW50U3RhcnRQb3MudG9wO1xuXG4gICAgdmFyIGVuZERpc3RhbmNlQmV0d2VlbkZpbmdlcnMgPSBkaXN0YW5jZShzZWxmLm5ld1BvaW50c1swXSwgc2VsZi5uZXdQb2ludHNbMV0pO1xuXG4gICAgdmFyIHBpbmNoUmF0aW8gPSBlbmREaXN0YW5jZUJldHdlZW5GaW5nZXJzIC8gc2VsZi5zdGFydERpc3RhbmNlQmV0d2VlbkZpbmdlcnM7XG5cbiAgICB2YXIgbmV3V2lkdGggPSBNYXRoLmZsb29yKGN1cnJlbnRXaWR0aCAqIHBpbmNoUmF0aW8pO1xuICAgIHZhciBuZXdIZWlnaHQgPSBNYXRoLmZsb29yKGN1cnJlbnRIZWlnaHQgKiBwaW5jaFJhdGlvKTtcblxuICAgIC8vIFRoaXMgaXMgdGhlIHRyYW5zbGF0aW9uIGR1ZSB0byBwaW5jaC16b29taW5nXG4gICAgdmFyIHRyYW5zbGF0ZUZyb21ab29taW5nWCA9IChjdXJyZW50V2lkdGggLSBuZXdXaWR0aCkgKiBzZWxmLnBlcmNlbnRhZ2VPZkltYWdlQXRQaW5jaFBvaW50WDtcbiAgICB2YXIgdHJhbnNsYXRlRnJvbVpvb21pbmdZID0gKGN1cnJlbnRIZWlnaHQgLSBuZXdIZWlnaHQpICogc2VsZi5wZXJjZW50YWdlT2ZJbWFnZUF0UGluY2hQb2ludFk7XG5cbiAgICAvLyBQb2ludCBiZXR3ZWVuIHRoZSB0d28gdG91Y2hlc1xuICAgIHZhciBjZW50ZXJQb2ludEVuZFggPSAoc2VsZi5uZXdQb2ludHNbMF0ueCArIHNlbGYubmV3UG9pbnRzWzFdLngpIC8gMiAtICQod2luZG93KS5zY3JvbGxMZWZ0KCk7XG4gICAgdmFyIGNlbnRlclBvaW50RW5kWSA9IChzZWxmLm5ld1BvaW50c1swXS55ICsgc2VsZi5uZXdQb2ludHNbMV0ueSkgLyAyIC0gJCh3aW5kb3cpLnNjcm9sbFRvcCgpO1xuXG4gICAgLy8gQW5kIHRoaXMgaXMgdGhlIHRyYW5zbGF0aW9uIGR1ZSB0byB0cmFuc2xhdGlvbiBvZiB0aGUgY2VudGVycG9pbnRcbiAgICAvLyBiZXR3ZWVuIHRoZSB0d28gZmluZ2Vyc1xuICAgIHZhciB0cmFuc2xhdGVGcm9tVHJhbnNsYXRpbmdYID0gY2VudGVyUG9pbnRFbmRYIC0gc2VsZi5jZW50ZXJQb2ludFN0YXJ0WDtcbiAgICB2YXIgdHJhbnNsYXRlRnJvbVRyYW5zbGF0aW5nWSA9IGNlbnRlclBvaW50RW5kWSAtIHNlbGYuY2VudGVyUG9pbnRTdGFydFk7XG5cbiAgICAvLyBUaGUgbmV3IG9mZnNldCBpcyB0aGUgb2xkL2N1cnJlbnQgb25lIHBsdXMgdGhlIHRvdGFsIHRyYW5zbGF0aW9uXG4gICAgdmFyIG5ld09mZnNldFggPSBjdXJyZW50T2Zmc2V0WCArICh0cmFuc2xhdGVGcm9tWm9vbWluZ1ggKyB0cmFuc2xhdGVGcm9tVHJhbnNsYXRpbmdYKTtcbiAgICB2YXIgbmV3T2Zmc2V0WSA9IGN1cnJlbnRPZmZzZXRZICsgKHRyYW5zbGF0ZUZyb21ab29taW5nWSArIHRyYW5zbGF0ZUZyb21UcmFuc2xhdGluZ1kpO1xuXG4gICAgdmFyIG5ld1BvcyA9IHtcbiAgICAgIHRvcDogbmV3T2Zmc2V0WSxcbiAgICAgIGxlZnQ6IG5ld09mZnNldFgsXG4gICAgICBzY2FsZVg6IHBpbmNoUmF0aW8sXG4gICAgICBzY2FsZVk6IHBpbmNoUmF0aW9cbiAgICB9O1xuXG4gICAgc2VsZi5jYW5UYXAgPSBmYWxzZTtcblxuICAgIHNlbGYubmV3V2lkdGggPSBuZXdXaWR0aDtcbiAgICBzZWxmLm5ld0hlaWdodCA9IG5ld0hlaWdodDtcblxuICAgIHNlbGYuY29udGVudExhc3RQb3MgPSBuZXdQb3M7XG5cbiAgICBpZiAoc2VsZi5yZXF1ZXN0SWQpIHtcbiAgICAgIGNhbmNlbEFGcmFtZShzZWxmLnJlcXVlc3RJZCk7XG5cbiAgICAgIHNlbGYucmVxdWVzdElkID0gbnVsbDtcbiAgICB9XG5cbiAgICBzZWxmLnJlcXVlc3RJZCA9IHJlcXVlc3RBRnJhbWUoZnVuY3Rpb24oKSB7XG4gICAgICAkLmZhbmN5Ym94LnNldFRyYW5zbGF0ZShzZWxmLiRjb250ZW50LCBzZWxmLmNvbnRlbnRMYXN0UG9zKTtcbiAgICB9KTtcbiAgfTtcblxuICBHdWVzdHVyZXMucHJvdG90eXBlLm9udG91Y2hlbmQgPSBmdW5jdGlvbihlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBkTXMgPSBNYXRoLm1heChuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHNlbGYuc3RhcnRUaW1lLCAxKTtcblxuICAgIHZhciBzd2lwaW5nID0gc2VsZi5pc1N3aXBpbmc7XG4gICAgdmFyIHBhbm5pbmcgPSBzZWxmLmlzUGFubmluZztcbiAgICB2YXIgem9vbWluZyA9IHNlbGYuaXNab29taW5nO1xuICAgIHZhciBzY3JvbGxpbmcgPSBzZWxmLmlzU2Nyb2xsaW5nO1xuXG4gICAgc2VsZi5lbmRQb2ludHMgPSBnZXRQb2ludGVyWFkoZSk7XG5cbiAgICBzZWxmLiRjb250YWluZXIucmVtb3ZlQ2xhc3MoXCJmYW5jeWJveC1jb250cm9scy0taXNHcmFiYmluZ1wiKTtcblxuICAgICQoZG9jdW1lbnQpLm9mZihcIi5mYi50b3VjaFwiKTtcblxuICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzY3JvbGxcIiwgc2VsZi5vbnNjcm9sbCwgdHJ1ZSk7XG5cbiAgICBpZiAoc2VsZi5yZXF1ZXN0SWQpIHtcbiAgICAgIGNhbmNlbEFGcmFtZShzZWxmLnJlcXVlc3RJZCk7XG5cbiAgICAgIHNlbGYucmVxdWVzdElkID0gbnVsbDtcbiAgICB9XG5cbiAgICBzZWxmLmlzU3dpcGluZyA9IGZhbHNlO1xuICAgIHNlbGYuaXNQYW5uaW5nID0gZmFsc2U7XG4gICAgc2VsZi5pc1pvb21pbmcgPSBmYWxzZTtcbiAgICBzZWxmLmlzU2Nyb2xsaW5nID0gZmFsc2U7XG5cbiAgICBzZWxmLmluc3RhbmNlLmlzRHJhZ2dpbmcgPSBmYWxzZTtcblxuICAgIGlmIChzZWxmLmNhblRhcCkge1xuICAgICAgcmV0dXJuIHNlbGYub25UYXAoZSk7XG4gICAgfVxuXG4gICAgc2VsZi5zcGVlZCA9IDM2NjtcblxuICAgIC8vIFNwZWVkIGluIHB4L21zXG4gICAgc2VsZi52ZWxvY2l0eVggPSBzZWxmLmRpc3RhbmNlWCAvIGRNcyAqIDAuNTtcbiAgICBzZWxmLnZlbG9jaXR5WSA9IHNlbGYuZGlzdGFuY2VZIC8gZE1zICogMC41O1xuXG4gICAgc2VsZi5zcGVlZFggPSBNYXRoLm1heChzZWxmLnNwZWVkICogMC41LCBNYXRoLm1pbihzZWxmLnNwZWVkICogMS41LCAxIC8gTWF0aC5hYnMoc2VsZi52ZWxvY2l0eVgpICogc2VsZi5zcGVlZCkpO1xuXG4gICAgaWYgKHBhbm5pbmcpIHtcbiAgICAgIHNlbGYuZW5kUGFubmluZygpO1xuICAgIH0gZWxzZSBpZiAoem9vbWluZykge1xuICAgICAgc2VsZi5lbmRab29taW5nKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuZW5kU3dpcGluZyhzd2lwaW5nLCBzY3JvbGxpbmcpO1xuICAgIH1cblxuICAgIHJldHVybjtcbiAgfTtcblxuICBHdWVzdHVyZXMucHJvdG90eXBlLmVuZFN3aXBpbmcgPSBmdW5jdGlvbihzd2lwaW5nLCBzY3JvbGxpbmcpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICByZXQgPSBmYWxzZSxcbiAgICAgIGxlbiA9IHNlbGYuaW5zdGFuY2UuZ3JvdXAubGVuZ3RoO1xuXG4gICAgc2VsZi5zbGlkZXJMYXN0UG9zID0gbnVsbDtcblxuICAgIC8vIENsb3NlIGlmIHN3aXBlZCB2ZXJ0aWNhbGx5IC8gbmF2aWdhdGUgaWYgaG9yaXpvbnRhbGx5XG4gICAgaWYgKHN3aXBpbmcgPT0gXCJ5XCIgJiYgIXNjcm9sbGluZyAmJiBNYXRoLmFicyhzZWxmLmRpc3RhbmNlWSkgPiA1MCkge1xuICAgICAgLy8gQ29udGludWUgdmVydGljYWwgbW92ZW1lbnRcbiAgICAgICQuZmFuY3lib3guYW5pbWF0ZShcbiAgICAgICAgc2VsZi5pbnN0YW5jZS5jdXJyZW50LiRzbGlkZSxcbiAgICAgICAge1xuICAgICAgICAgIHRvcDogc2VsZi5zbGlkZXJTdGFydFBvcy50b3AgKyBzZWxmLmRpc3RhbmNlWSArIHNlbGYudmVsb2NpdHlZICogMTUwLFxuICAgICAgICAgIG9wYWNpdHk6IDBcbiAgICAgICAgfSxcbiAgICAgICAgMjAwXG4gICAgICApO1xuXG4gICAgICByZXQgPSBzZWxmLmluc3RhbmNlLmNsb3NlKHRydWUsIDIwMCk7XG4gICAgfSBlbHNlIGlmIChzd2lwaW5nID09IFwieFwiICYmIHNlbGYuZGlzdGFuY2VYID4gNTAgJiYgbGVuID4gMSkge1xuICAgICAgcmV0ID0gc2VsZi5pbnN0YW5jZS5wcmV2aW91cyhzZWxmLnNwZWVkWCk7XG4gICAgfSBlbHNlIGlmIChzd2lwaW5nID09IFwieFwiICYmIHNlbGYuZGlzdGFuY2VYIDwgLTUwICYmIGxlbiA+IDEpIHtcbiAgICAgIHJldCA9IHNlbGYuaW5zdGFuY2UubmV4dChzZWxmLnNwZWVkWCk7XG4gICAgfVxuXG4gICAgaWYgKHJldCA9PT0gZmFsc2UgJiYgKHN3aXBpbmcgPT0gXCJ4XCIgfHwgc3dpcGluZyA9PSBcInlcIikpIHtcbiAgICAgIGlmIChzY3JvbGxpbmcgfHwgbGVuIDwgMikge1xuICAgICAgICBzZWxmLmluc3RhbmNlLmNlbnRlclNsaWRlKHNlbGYuaW5zdGFuY2UuY3VycmVudCwgMTUwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuaW5zdGFuY2UuanVtcFRvKHNlbGYuaW5zdGFuY2UuY3VycmVudC5pbmRleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZi4kY29udGFpbmVyLnJlbW92ZUNsYXNzKFwiZmFuY3lib3gtaXMtc2xpZGluZ1wiKTtcbiAgfTtcblxuICAvLyBMaW1pdCBwYW5uaW5nIGZyb20gZWRnZXNcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09XG4gIEd1ZXN0dXJlcy5wcm90b3R5cGUuZW5kUGFubmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgbmV3T2Zmc2V0WCwgbmV3T2Zmc2V0WSwgbmV3UG9zO1xuXG4gICAgaWYgKCFzZWxmLmNvbnRlbnRMYXN0UG9zKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHNlbGYub3B0cy5tb21lbnR1bSA9PT0gZmFsc2UpIHtcbiAgICAgIG5ld09mZnNldFggPSBzZWxmLmNvbnRlbnRMYXN0UG9zLmxlZnQ7XG4gICAgICBuZXdPZmZzZXRZID0gc2VsZi5jb250ZW50TGFzdFBvcy50b3A7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENvbnRpbnVlIG1vdmVtZW50XG4gICAgICBuZXdPZmZzZXRYID0gc2VsZi5jb250ZW50TGFzdFBvcy5sZWZ0ICsgc2VsZi52ZWxvY2l0eVggKiBzZWxmLnNwZWVkO1xuICAgICAgbmV3T2Zmc2V0WSA9IHNlbGYuY29udGVudExhc3RQb3MudG9wICsgc2VsZi52ZWxvY2l0eVkgKiBzZWxmLnNwZWVkO1xuICAgIH1cblxuICAgIG5ld1BvcyA9IHNlbGYubGltaXRQb3NpdGlvbihuZXdPZmZzZXRYLCBuZXdPZmZzZXRZLCBzZWxmLmNvbnRlbnRTdGFydFBvcy53aWR0aCwgc2VsZi5jb250ZW50U3RhcnRQb3MuaGVpZ2h0KTtcblxuICAgIG5ld1Bvcy53aWR0aCA9IHNlbGYuY29udGVudFN0YXJ0UG9zLndpZHRoO1xuICAgIG5ld1Bvcy5oZWlnaHQgPSBzZWxmLmNvbnRlbnRTdGFydFBvcy5oZWlnaHQ7XG5cbiAgICAkLmZhbmN5Ym94LmFuaW1hdGUoc2VsZi4kY29udGVudCwgbmV3UG9zLCAzMzApO1xuICB9O1xuXG4gIEd1ZXN0dXJlcy5wcm90b3R5cGUuZW5kWm9vbWluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBjdXJyZW50ID0gc2VsZi5pbnN0YW5jZS5jdXJyZW50O1xuXG4gICAgdmFyIG5ld09mZnNldFgsIG5ld09mZnNldFksIG5ld1BvcywgcmVzZXQ7XG5cbiAgICB2YXIgbmV3V2lkdGggPSBzZWxmLm5ld1dpZHRoO1xuICAgIHZhciBuZXdIZWlnaHQgPSBzZWxmLm5ld0hlaWdodDtcblxuICAgIGlmICghc2VsZi5jb250ZW50TGFzdFBvcykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG5ld09mZnNldFggPSBzZWxmLmNvbnRlbnRMYXN0UG9zLmxlZnQ7XG4gICAgbmV3T2Zmc2V0WSA9IHNlbGYuY29udGVudExhc3RQb3MudG9wO1xuXG4gICAgcmVzZXQgPSB7XG4gICAgICB0b3A6IG5ld09mZnNldFksXG4gICAgICBsZWZ0OiBuZXdPZmZzZXRYLFxuICAgICAgd2lkdGg6IG5ld1dpZHRoLFxuICAgICAgaGVpZ2h0OiBuZXdIZWlnaHQsXG4gICAgICBzY2FsZVg6IDEsXG4gICAgICBzY2FsZVk6IDFcbiAgICB9O1xuXG4gICAgLy8gUmVzZXQgc2NhbGV4L3NjYWxlWSB2YWx1ZXM7IHRoaXMgaGVscHMgZm9yIHBlcmZvbWFuY2UgYW5kIGRvZXMgbm90IGJyZWFrIGFuaW1hdGlvblxuICAgICQuZmFuY3lib3guc2V0VHJhbnNsYXRlKHNlbGYuJGNvbnRlbnQsIHJlc2V0KTtcblxuICAgIGlmIChuZXdXaWR0aCA8IHNlbGYuY2FudmFzV2lkdGggJiYgbmV3SGVpZ2h0IDwgc2VsZi5jYW52YXNIZWlnaHQpIHtcbiAgICAgIHNlbGYuaW5zdGFuY2Uuc2NhbGVUb0ZpdCgxNTApO1xuICAgIH0gZWxzZSBpZiAobmV3V2lkdGggPiBjdXJyZW50LndpZHRoIHx8IG5ld0hlaWdodCA+IGN1cnJlbnQuaGVpZ2h0KSB7XG4gICAgICBzZWxmLmluc3RhbmNlLnNjYWxlVG9BY3R1YWwoc2VsZi5jZW50ZXJQb2ludFN0YXJ0WCwgc2VsZi5jZW50ZXJQb2ludFN0YXJ0WSwgMTUwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV3UG9zID0gc2VsZi5saW1pdFBvc2l0aW9uKG5ld09mZnNldFgsIG5ld09mZnNldFksIG5ld1dpZHRoLCBuZXdIZWlnaHQpO1xuXG4gICAgICAvLyBTd2l0Y2ggZnJvbSBzY2FsZSgpIHRvIHdpZHRoL2hlaWdodCBvciBhbmltYXRpb24gd2lsbCBub3Qgd29yayBjb3JyZWN0bHlcbiAgICAgICQuZmFuY3lib3guc2V0VHJhbnNsYXRlKHNlbGYuJGNvbnRlbnQsICQuZmFuY3lib3guZ2V0VHJhbnNsYXRlKHNlbGYuJGNvbnRlbnQpKTtcblxuICAgICAgJC5mYW5jeWJveC5hbmltYXRlKHNlbGYuJGNvbnRlbnQsIG5ld1BvcywgMTUwKTtcbiAgICB9XG4gIH07XG5cbiAgR3Vlc3R1cmVzLnByb3RvdHlwZS5vblRhcCA9IGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyICR0YXJnZXQgPSAkKGUudGFyZ2V0KTtcblxuICAgIHZhciBpbnN0YW5jZSA9IHNlbGYuaW5zdGFuY2U7XG4gICAgdmFyIGN1cnJlbnQgPSBpbnN0YW5jZS5jdXJyZW50O1xuXG4gICAgdmFyIGVuZFBvaW50cyA9IChlICYmIGdldFBvaW50ZXJYWShlKSkgfHwgc2VsZi5zdGFydFBvaW50cztcblxuICAgIHZhciB0YXBYID0gZW5kUG9pbnRzWzBdID8gZW5kUG9pbnRzWzBdLnggLSAkKHdpbmRvdykuc2Nyb2xsTGVmdCgpIC0gc2VsZi5zdGFnZVBvcy5sZWZ0IDogMDtcbiAgICB2YXIgdGFwWSA9IGVuZFBvaW50c1swXSA/IGVuZFBvaW50c1swXS55IC0gJCh3aW5kb3cpLnNjcm9sbFRvcCgpIC0gc2VsZi5zdGFnZVBvcy50b3AgOiAwO1xuXG4gICAgdmFyIHdoZXJlO1xuXG4gICAgdmFyIHByb2Nlc3MgPSBmdW5jdGlvbihwcmVmaXgpIHtcbiAgICAgIHZhciBhY3Rpb24gPSBjdXJyZW50Lm9wdHNbcHJlZml4XTtcblxuICAgICAgaWYgKCQuaXNGdW5jdGlvbihhY3Rpb24pKSB7XG4gICAgICAgIGFjdGlvbiA9IGFjdGlvbi5hcHBseShpbnN0YW5jZSwgW2N1cnJlbnQsIGVdKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFhY3Rpb24pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKGFjdGlvbikge1xuICAgICAgICBjYXNlIFwiY2xvc2VcIjpcbiAgICAgICAgICBpbnN0YW5jZS5jbG9zZShzZWxmLnN0YXJ0RXZlbnQpO1xuXG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBcInRvZ2dsZUNvbnRyb2xzXCI6XG4gICAgICAgICAgaW5zdGFuY2UudG9nZ2xlQ29udHJvbHModHJ1ZSk7XG5cbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIFwibmV4dFwiOlxuICAgICAgICAgIGluc3RhbmNlLm5leHQoKTtcblxuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgXCJuZXh0T3JDbG9zZVwiOlxuICAgICAgICAgIGlmIChpbnN0YW5jZS5ncm91cC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBpbnN0YW5jZS5uZXh0KCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGluc3RhbmNlLmNsb3NlKHNlbGYuc3RhcnRFdmVudCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBcInpvb21cIjpcbiAgICAgICAgICBpZiAoY3VycmVudC50eXBlID09IFwiaW1hZ2VcIiAmJiAoY3VycmVudC5pc0xvYWRlZCB8fCBjdXJyZW50LiRnaG9zdCkpIHtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZS5jYW5QYW4oKSkge1xuICAgICAgICAgICAgICBpbnN0YW5jZS5zY2FsZVRvRml0KCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGluc3RhbmNlLmlzU2NhbGVkRG93bigpKSB7XG4gICAgICAgICAgICAgIGluc3RhbmNlLnNjYWxlVG9BY3R1YWwodGFwWCwgdGFwWSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGluc3RhbmNlLmdyb3VwLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgaW5zdGFuY2UuY2xvc2Uoc2VsZi5zdGFydEV2ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gSWdub3JlIHJpZ2h0IGNsaWNrXG4gICAgaWYgKGUub3JpZ2luYWxFdmVudCAmJiBlLm9yaWdpbmFsRXZlbnQuYnV0dG9uID09IDIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTa2lwIGlmIGNsaWNrZWQgb24gdGhlIHNjcm9sbGJhclxuICAgIGlmICghJHRhcmdldC5pcyhcImltZ1wiKSAmJiB0YXBYID4gJHRhcmdldFswXS5jbGllbnRXaWR0aCArICR0YXJnZXQub2Zmc2V0KCkubGVmdCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIENoZWNrIHdoZXJlIGlzIGNsaWNrZWRcbiAgICBpZiAoJHRhcmdldC5pcyhcIi5mYW5jeWJveC1iZywuZmFuY3lib3gtaW5uZXIsLmZhbmN5Ym94LW91dGVyLC5mYW5jeWJveC1jb250YWluZXJcIikpIHtcbiAgICAgIHdoZXJlID0gXCJPdXRzaWRlXCI7XG4gICAgfSBlbHNlIGlmICgkdGFyZ2V0LmlzKFwiLmZhbmN5Ym94LXNsaWRlXCIpKSB7XG4gICAgICB3aGVyZSA9IFwiU2xpZGVcIjtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgaW5zdGFuY2UuY3VycmVudC4kY29udGVudCAmJlxuICAgICAgaW5zdGFuY2UuY3VycmVudC4kY29udGVudFxuICAgICAgICAuZmluZCgkdGFyZ2V0KVxuICAgICAgICAuYWRkQmFjaygpXG4gICAgICAgIC5maWx0ZXIoJHRhcmdldCkubGVuZ3RoXG4gICAgKSB7XG4gICAgICB3aGVyZSA9IFwiQ29udGVudFwiO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgdGhpcyBpcyBhIGRvdWJsZSB0YXBcbiAgICBpZiAoc2VsZi50YXBwZWQpIHtcbiAgICAgIC8vIFN0b3AgcHJldmlvdXNseSBjcmVhdGVkIHNpbmdsZSB0YXBcbiAgICAgIGNsZWFyVGltZW91dChzZWxmLnRhcHBlZCk7XG4gICAgICBzZWxmLnRhcHBlZCA9IG51bGw7XG5cbiAgICAgIC8vIFNraXAgaWYgZGlzdGFuY2UgYmV0d2VlbiB0YXBzIGlzIHRvbyBiaWdcbiAgICAgIGlmIChNYXRoLmFicyh0YXBYIC0gc2VsZi50YXBYKSA+IDUwIHx8IE1hdGguYWJzKHRhcFkgLSBzZWxmLnRhcFkpID4gNTApIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG5cbiAgICAgIC8vIE9LLCBub3cgd2UgYXNzdW1lIHRoYXQgdGhpcyBpcyBhIGRvdWJsZS10YXBcbiAgICAgIHByb2Nlc3MoXCJkYmxjbGlja1wiICsgd2hlcmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBTaW5nbGUgdGFwIHdpbGwgYmUgcHJvY2Vzc2VkIGlmIHVzZXIgaGFzIG5vdCBjbGlja2VkIHNlY29uZCB0aW1lIHdpdGhpbiAzMDBtc1xuICAgICAgLy8gb3IgdGhlcmUgaXMgbm8gbmVlZCB0byB3YWl0IGZvciBkb3VibGUtdGFwXG4gICAgICBzZWxmLnRhcFggPSB0YXBYO1xuICAgICAgc2VsZi50YXBZID0gdGFwWTtcblxuICAgICAgaWYgKGN1cnJlbnQub3B0c1tcImRibGNsaWNrXCIgKyB3aGVyZV0gJiYgY3VycmVudC5vcHRzW1wiZGJsY2xpY2tcIiArIHdoZXJlXSAhPT0gY3VycmVudC5vcHRzW1wiY2xpY2tcIiArIHdoZXJlXSkge1xuICAgICAgICBzZWxmLnRhcHBlZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgc2VsZi50YXBwZWQgPSBudWxsO1xuXG4gICAgICAgICAgcHJvY2VzcyhcImNsaWNrXCIgKyB3aGVyZSk7XG4gICAgICAgIH0sIDUwMCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9jZXNzKFwiY2xpY2tcIiArIHdoZXJlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAkKGRvY3VtZW50KS5vbihcIm9uQWN0aXZhdGUuZmJcIiwgZnVuY3Rpb24oZSwgaW5zdGFuY2UpIHtcbiAgICBpZiAoaW5zdGFuY2UgJiYgIWluc3RhbmNlLkd1ZXN0dXJlcykge1xuICAgICAgaW5zdGFuY2UuR3Vlc3R1cmVzID0gbmV3IEd1ZXN0dXJlcyhpbnN0YW5jZSk7XG4gICAgfVxuICB9KTtcbn0pKHdpbmRvdywgZG9jdW1lbnQsIHdpbmRvdy5qUXVlcnkgfHwgalF1ZXJ5KTtcblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbi8vXG4vLyBTbGlkZVNob3dcbi8vIEVuYWJsZXMgc2xpZGVzaG93IGZ1bmN0aW9uYWxpdHlcbi8vXG4vLyBFeGFtcGxlIG9mIHVzYWdlOlxuLy8gJC5mYW5jeWJveC5nZXRJbnN0YW5jZSgpLlNsaWRlU2hvdy5zdGFydCgpXG4vL1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbihmdW5jdGlvbihkb2N1bWVudCwgJCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICAkLmV4dGVuZCh0cnVlLCAkLmZhbmN5Ym94LmRlZmF1bHRzLCB7XG4gICAgYnRuVHBsOiB7XG4gICAgICBzbGlkZVNob3c6XG4gICAgICAgICc8YnV0dG9uIGRhdGEtZmFuY3lib3gtcGxheSBjbGFzcz1cImZhbmN5Ym94LWJ1dHRvbiBmYW5jeWJveC1idXR0b24tLXBsYXlcIiB0aXRsZT1cInt7UExBWV9TVEFSVH19XCI+JyArXG4gICAgICAgICc8c3ZnIHZpZXdCb3g9XCIwIDAgNDAgNDBcIj4nICtcbiAgICAgICAgJzxwYXRoIGQ9XCJNMTMsMTIgTDI3LDIwIEwxMywyNyBaXCIgLz4nICtcbiAgICAgICAgJzxwYXRoIGQ9XCJNMTUsMTAgdjE5IE0yMywxMCB2MTlcIiAvPicgK1xuICAgICAgICBcIjwvc3ZnPlwiICtcbiAgICAgICAgXCI8L2J1dHRvbj5cIlxuICAgIH0sXG4gICAgc2xpZGVTaG93OiB7XG4gICAgICBhdXRvU3RhcnQ6IGZhbHNlLFxuICAgICAgc3BlZWQ6IDMwMDBcbiAgICB9XG4gIH0pO1xuXG4gIHZhciBTbGlkZVNob3cgPSBmdW5jdGlvbihpbnN0YW5jZSkge1xuICAgIHRoaXMuaW5zdGFuY2UgPSBpbnN0YW5jZTtcbiAgICB0aGlzLmluaXQoKTtcbiAgfTtcblxuICAkLmV4dGVuZChTbGlkZVNob3cucHJvdG90eXBlLCB7XG4gICAgdGltZXI6IG51bGwsXG4gICAgaXNBY3RpdmU6IGZhbHNlLFxuICAgICRidXR0b246IG51bGwsXG5cbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgc2VsZi4kYnV0dG9uID0gc2VsZi5pbnN0YW5jZS4kcmVmcy50b29sYmFyLmZpbmQoXCJbZGF0YS1mYW5jeWJveC1wbGF5XVwiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLnRvZ2dsZSgpO1xuICAgICAgfSk7XG5cbiAgICAgIGlmIChzZWxmLmluc3RhbmNlLmdyb3VwLmxlbmd0aCA8IDIgfHwgIXNlbGYuaW5zdGFuY2UuZ3JvdXBbc2VsZi5pbnN0YW5jZS5jdXJySW5kZXhdLm9wdHMuc2xpZGVTaG93KSB7XG4gICAgICAgIHNlbGYuJGJ1dHRvbi5oaWRlKCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIHNldDogZnVuY3Rpb24oZm9yY2UpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgLy8gQ2hlY2sgaWYgcmVhY2hlZCBsYXN0IGVsZW1lbnRcbiAgICAgIGlmIChcbiAgICAgICAgc2VsZi5pbnN0YW5jZSAmJlxuICAgICAgICBzZWxmLmluc3RhbmNlLmN1cnJlbnQgJiZcbiAgICAgICAgKGZvcmNlID09PSB0cnVlIHx8IHNlbGYuaW5zdGFuY2UuY3VycmVudC5vcHRzLmxvb3AgfHwgc2VsZi5pbnN0YW5jZS5jdXJySW5kZXggPCBzZWxmLmluc3RhbmNlLmdyb3VwLmxlbmd0aCAtIDEpXG4gICAgICApIHtcbiAgICAgICAgc2VsZi50aW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKHNlbGYuaXNBY3RpdmUpIHtcbiAgICAgICAgICAgIHNlbGYuaW5zdGFuY2UuanVtcFRvKChzZWxmLmluc3RhbmNlLmN1cnJJbmRleCArIDEpICUgc2VsZi5pbnN0YW5jZS5ncm91cC5sZW5ndGgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgc2VsZi5pbnN0YW5jZS5jdXJyZW50Lm9wdHMuc2xpZGVTaG93LnNwZWVkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuc3RvcCgpO1xuICAgICAgICBzZWxmLmluc3RhbmNlLmlkbGVTZWNvbmRzQ291bnRlciA9IDA7XG4gICAgICAgIHNlbGYuaW5zdGFuY2Uuc2hvd0NvbnRyb2xzKCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIGNsZWFyOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgY2xlYXJUaW1lb3V0KHNlbGYudGltZXIpO1xuXG4gICAgICBzZWxmLnRpbWVyID0gbnVsbDtcbiAgICB9LFxuXG4gICAgc3RhcnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIGN1cnJlbnQgPSBzZWxmLmluc3RhbmNlLmN1cnJlbnQ7XG5cbiAgICAgIGlmIChjdXJyZW50KSB7XG4gICAgICAgIHNlbGYuaXNBY3RpdmUgPSB0cnVlO1xuXG4gICAgICAgIHNlbGYuJGJ1dHRvblxuICAgICAgICAgIC5hdHRyKFwidGl0bGVcIiwgY3VycmVudC5vcHRzLmkxOG5bY3VycmVudC5vcHRzLmxhbmddLlBMQVlfU1RPUClcbiAgICAgICAgICAucmVtb3ZlQ2xhc3MoXCJmYW5jeWJveC1idXR0b24tLXBsYXlcIilcbiAgICAgICAgICAuYWRkQ2xhc3MoXCJmYW5jeWJveC1idXR0b24tLXBhdXNlXCIpO1xuXG4gICAgICAgIHNlbGYuc2V0KHRydWUpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBzdG9wOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHZhciBjdXJyZW50ID0gc2VsZi5pbnN0YW5jZS5jdXJyZW50O1xuXG4gICAgICBzZWxmLmNsZWFyKCk7XG5cbiAgICAgIHNlbGYuJGJ1dHRvblxuICAgICAgICAuYXR0cihcInRpdGxlXCIsIGN1cnJlbnQub3B0cy5pMThuW2N1cnJlbnQub3B0cy5sYW5nXS5QTEFZX1NUQVJUKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoXCJmYW5jeWJveC1idXR0b24tLXBhdXNlXCIpXG4gICAgICAgIC5hZGRDbGFzcyhcImZhbmN5Ym94LWJ1dHRvbi0tcGxheVwiKTtcblxuICAgICAgc2VsZi5pc0FjdGl2ZSA9IGZhbHNlO1xuICAgIH0sXG5cbiAgICB0b2dnbGU6IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICBpZiAoc2VsZi5pc0FjdGl2ZSkge1xuICAgICAgICBzZWxmLnN0b3AoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuc3RhcnQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gICQoZG9jdW1lbnQpLm9uKHtcbiAgICBcIm9uSW5pdC5mYlwiOiBmdW5jdGlvbihlLCBpbnN0YW5jZSkge1xuICAgICAgaWYgKGluc3RhbmNlICYmICFpbnN0YW5jZS5TbGlkZVNob3cpIHtcbiAgICAgICAgaW5zdGFuY2UuU2xpZGVTaG93ID0gbmV3IFNsaWRlU2hvdyhpbnN0YW5jZSk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIFwiYmVmb3JlU2hvdy5mYlwiOiBmdW5jdGlvbihlLCBpbnN0YW5jZSwgY3VycmVudCwgZmlyc3RSdW4pIHtcbiAgICAgIHZhciBTbGlkZVNob3cgPSBpbnN0YW5jZSAmJiBpbnN0YW5jZS5TbGlkZVNob3c7XG5cbiAgICAgIGlmIChmaXJzdFJ1bikge1xuICAgICAgICBpZiAoU2xpZGVTaG93ICYmIGN1cnJlbnQub3B0cy5zbGlkZVNob3cuYXV0b1N0YXJ0KSB7XG4gICAgICAgICAgU2xpZGVTaG93LnN0YXJ0KCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoU2xpZGVTaG93ICYmIFNsaWRlU2hvdy5pc0FjdGl2ZSkge1xuICAgICAgICBTbGlkZVNob3cuY2xlYXIoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJhZnRlclNob3cuZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UsIGN1cnJlbnQpIHtcbiAgICAgIHZhciBTbGlkZVNob3cgPSBpbnN0YW5jZSAmJiBpbnN0YW5jZS5TbGlkZVNob3c7XG5cbiAgICAgIGlmIChTbGlkZVNob3cgJiYgU2xpZGVTaG93LmlzQWN0aXZlKSB7XG4gICAgICAgIFNsaWRlU2hvdy5zZXQoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJhZnRlcktleWRvd24uZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UsIGN1cnJlbnQsIGtleXByZXNzLCBrZXljb2RlKSB7XG4gICAgICB2YXIgU2xpZGVTaG93ID0gaW5zdGFuY2UgJiYgaW5zdGFuY2UuU2xpZGVTaG93O1xuXG4gICAgICAvLyBcIlBcIiBvciBTcGFjZWJhclxuICAgICAgaWYgKFNsaWRlU2hvdyAmJiBjdXJyZW50Lm9wdHMuc2xpZGVTaG93ICYmIChrZXljb2RlID09PSA4MCB8fCBrZXljb2RlID09PSAzMikgJiYgISQoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkuaXMoXCJidXR0b24sYSxpbnB1dFwiKSkge1xuICAgICAgICBrZXlwcmVzcy5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIFNsaWRlU2hvdy50b2dnbGUoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJiZWZvcmVDbG9zZS5mYiBvbkRlYWN0aXZhdGUuZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UpIHtcbiAgICAgIHZhciBTbGlkZVNob3cgPSBpbnN0YW5jZSAmJiBpbnN0YW5jZS5TbGlkZVNob3c7XG5cbiAgICAgIGlmIChTbGlkZVNob3cpIHtcbiAgICAgICAgU2xpZGVTaG93LnN0b3AoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIC8vIFBhZ2UgVmlzaWJpbGl0eSBBUEkgdG8gcGF1c2Ugc2xpZGVzaG93IHdoZW4gd2luZG93IGlzIG5vdCBhY3RpdmVcbiAgJChkb2N1bWVudCkub24oXCJ2aXNpYmlsaXR5Y2hhbmdlXCIsIGZ1bmN0aW9uKCkge1xuICAgIHZhciBpbnN0YW5jZSA9ICQuZmFuY3lib3guZ2V0SW5zdGFuY2UoKTtcbiAgICB2YXIgU2xpZGVTaG93ID0gaW5zdGFuY2UgJiYgaW5zdGFuY2UuU2xpZGVTaG93O1xuXG4gICAgaWYgKFNsaWRlU2hvdyAmJiBTbGlkZVNob3cuaXNBY3RpdmUpIHtcbiAgICAgIGlmIChkb2N1bWVudC5oaWRkZW4pIHtcbiAgICAgICAgU2xpZGVTaG93LmNsZWFyKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBTbGlkZVNob3cuc2V0KCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn0pKGRvY3VtZW50LCB3aW5kb3cualF1ZXJ5IHx8IGpRdWVyeSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vL1xuLy8gRnVsbFNjcmVlblxuLy8gQWRkcyBmdWxsc2NyZWVuIGZ1bmN0aW9uYWxpdHlcbi8vXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuKGZ1bmN0aW9uKGRvY3VtZW50LCAkKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIC8vIENvbGxlY3Rpb24gb2YgbWV0aG9kcyBzdXBwb3J0ZWQgYnkgdXNlciBicm93c2VyXG4gIHZhciBmbiA9IChmdW5jdGlvbigpIHtcbiAgICB2YXIgZm5NYXAgPSBbXG4gICAgICBbXCJyZXF1ZXN0RnVsbHNjcmVlblwiLCBcImV4aXRGdWxsc2NyZWVuXCIsIFwiZnVsbHNjcmVlbkVsZW1lbnRcIiwgXCJmdWxsc2NyZWVuRW5hYmxlZFwiLCBcImZ1bGxzY3JlZW5jaGFuZ2VcIiwgXCJmdWxsc2NyZWVuZXJyb3JcIl0sXG4gICAgICAvLyBuZXcgV2ViS2l0XG4gICAgICBbXG4gICAgICAgIFwid2Via2l0UmVxdWVzdEZ1bGxzY3JlZW5cIixcbiAgICAgICAgXCJ3ZWJraXRFeGl0RnVsbHNjcmVlblwiLFxuICAgICAgICBcIndlYmtpdEZ1bGxzY3JlZW5FbGVtZW50XCIsXG4gICAgICAgIFwid2Via2l0RnVsbHNjcmVlbkVuYWJsZWRcIixcbiAgICAgICAgXCJ3ZWJraXRmdWxsc2NyZWVuY2hhbmdlXCIsXG4gICAgICAgIFwid2Via2l0ZnVsbHNjcmVlbmVycm9yXCJcbiAgICAgIF0sXG4gICAgICAvLyBvbGQgV2ViS2l0IChTYWZhcmkgNS4xKVxuICAgICAgW1xuICAgICAgICBcIndlYmtpdFJlcXVlc3RGdWxsU2NyZWVuXCIsXG4gICAgICAgIFwid2Via2l0Q2FuY2VsRnVsbFNjcmVlblwiLFxuICAgICAgICBcIndlYmtpdEN1cnJlbnRGdWxsU2NyZWVuRWxlbWVudFwiLFxuICAgICAgICBcIndlYmtpdENhbmNlbEZ1bGxTY3JlZW5cIixcbiAgICAgICAgXCJ3ZWJraXRmdWxsc2NyZWVuY2hhbmdlXCIsXG4gICAgICAgIFwid2Via2l0ZnVsbHNjcmVlbmVycm9yXCJcbiAgICAgIF0sXG4gICAgICBbXG4gICAgICAgIFwibW96UmVxdWVzdEZ1bGxTY3JlZW5cIixcbiAgICAgICAgXCJtb3pDYW5jZWxGdWxsU2NyZWVuXCIsXG4gICAgICAgIFwibW96RnVsbFNjcmVlbkVsZW1lbnRcIixcbiAgICAgICAgXCJtb3pGdWxsU2NyZWVuRW5hYmxlZFwiLFxuICAgICAgICBcIm1vemZ1bGxzY3JlZW5jaGFuZ2VcIixcbiAgICAgICAgXCJtb3pmdWxsc2NyZWVuZXJyb3JcIlxuICAgICAgXSxcbiAgICAgIFtcIm1zUmVxdWVzdEZ1bGxzY3JlZW5cIiwgXCJtc0V4aXRGdWxsc2NyZWVuXCIsIFwibXNGdWxsc2NyZWVuRWxlbWVudFwiLCBcIm1zRnVsbHNjcmVlbkVuYWJsZWRcIiwgXCJNU0Z1bGxzY3JlZW5DaGFuZ2VcIiwgXCJNU0Z1bGxzY3JlZW5FcnJvclwiXVxuICAgIF07XG5cbiAgICB2YXIgcmV0ID0ge307XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZuTWFwLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgdmFsID0gZm5NYXBbaV07XG5cbiAgICAgIGlmICh2YWwgJiYgdmFsWzFdIGluIGRvY3VtZW50KSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdmFsLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgcmV0W2ZuTWFwWzBdW2pdXSA9IHZhbFtqXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9KSgpO1xuXG4gIC8vIElmIGJyb3dzZXIgZG9lcyBub3QgaGF2ZSBGdWxsIFNjcmVlbiBBUEksIHRoZW4gc2ltcGx5IHVuc2V0IGRlZmF1bHQgYnV0dG9uIHRlbXBsYXRlIGFuZCBzdG9wXG4gIGlmICghZm4pIHtcbiAgICBpZiAoJCAmJiAkLmZhbmN5Ym94KSB7XG4gICAgICAkLmZhbmN5Ym94LmRlZmF1bHRzLmJ0blRwbC5mdWxsU2NyZWVuID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIEZ1bGxTY3JlZW4gPSB7XG4gICAgcmVxdWVzdDogZnVuY3Rpb24oZWxlbSkge1xuICAgICAgZWxlbSA9IGVsZW0gfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuXG4gICAgICBlbGVtW2ZuLnJlcXVlc3RGdWxsc2NyZWVuXShlbGVtLkFMTE9XX0tFWUJPQVJEX0lOUFVUKTtcbiAgICB9LFxuICAgIGV4aXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgZG9jdW1lbnRbZm4uZXhpdEZ1bGxzY3JlZW5dKCk7XG4gICAgfSxcbiAgICB0b2dnbGU6IGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgIGVsZW0gPSBlbGVtIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblxuICAgICAgaWYgKHRoaXMuaXNGdWxsc2NyZWVuKCkpIHtcbiAgICAgICAgdGhpcy5leGl0KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlcXVlc3QoZWxlbSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBpc0Z1bGxzY3JlZW46IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIEJvb2xlYW4oZG9jdW1lbnRbZm4uZnVsbHNjcmVlbkVsZW1lbnRdKTtcbiAgICB9LFxuICAgIGVuYWJsZWQ6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIEJvb2xlYW4oZG9jdW1lbnRbZm4uZnVsbHNjcmVlbkVuYWJsZWRdKTtcbiAgICB9XG4gIH07XG5cbiAgJC5leHRlbmQodHJ1ZSwgJC5mYW5jeWJveC5kZWZhdWx0cywge1xuICAgIGJ0blRwbDoge1xuICAgICAgZnVsbFNjcmVlbjpcbiAgICAgICAgJzxidXR0b24gZGF0YS1mYW5jeWJveC1mdWxsc2NyZWVuIGNsYXNzPVwiZmFuY3lib3gtYnV0dG9uIGZhbmN5Ym94LWJ1dHRvbi0tZnVsbHNjcmVlblwiIHRpdGxlPVwie3tGVUxMX1NDUkVFTn19XCI+JyArXG4gICAgICAgICc8c3ZnIHZpZXdCb3g9XCIwIDAgNDAgNDBcIj4nICtcbiAgICAgICAgJzxwYXRoIGQ9XCJNOSwxMiB2MTYgaDIyIHYtMTYgaC0yMiB2OFwiIC8+JyArXG4gICAgICAgIFwiPC9zdmc+XCIgK1xuICAgICAgICBcIjwvYnV0dG9uPlwiXG4gICAgfSxcbiAgICBmdWxsU2NyZWVuOiB7XG4gICAgICBhdXRvU3RhcnQ6IGZhbHNlXG4gICAgfVxuICB9KTtcblxuICAkKGRvY3VtZW50KS5vbih7XG4gICAgXCJvbkluaXQuZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UpIHtcbiAgICAgIHZhciAkY29udGFpbmVyO1xuXG4gICAgICBpZiAoaW5zdGFuY2UgJiYgaW5zdGFuY2UuZ3JvdXBbaW5zdGFuY2UuY3VyckluZGV4XS5vcHRzLmZ1bGxTY3JlZW4pIHtcbiAgICAgICAgJGNvbnRhaW5lciA9IGluc3RhbmNlLiRyZWZzLmNvbnRhaW5lcjtcblxuICAgICAgICAkY29udGFpbmVyLm9uKFwiY2xpY2suZmItZnVsbHNjcmVlblwiLCBcIltkYXRhLWZhbmN5Ym94LWZ1bGxzY3JlZW5dXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgIEZ1bGxTY3JlZW4udG9nZ2xlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChpbnN0YW5jZS5vcHRzLmZ1bGxTY3JlZW4gJiYgaW5zdGFuY2Uub3B0cy5mdWxsU2NyZWVuLmF1dG9TdGFydCA9PT0gdHJ1ZSkge1xuICAgICAgICAgIEZ1bGxTY3JlZW4ucmVxdWVzdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRXhwb3NlIEFQSVxuICAgICAgICBpbnN0YW5jZS5GdWxsU2NyZWVuID0gRnVsbFNjcmVlbjtcbiAgICAgIH0gZWxzZSBpZiAoaW5zdGFuY2UpIHtcbiAgICAgICAgaW5zdGFuY2UuJHJlZnMudG9vbGJhci5maW5kKFwiW2RhdGEtZmFuY3lib3gtZnVsbHNjcmVlbl1cIikuaGlkZSgpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICBcImFmdGVyS2V5ZG93bi5mYlwiOiBmdW5jdGlvbihlLCBpbnN0YW5jZSwgY3VycmVudCwga2V5cHJlc3MsIGtleWNvZGUpIHtcbiAgICAgIC8vIFwiRlwiXG4gICAgICBpZiAoaW5zdGFuY2UgJiYgaW5zdGFuY2UuRnVsbFNjcmVlbiAmJiBrZXljb2RlID09PSA3MCkge1xuICAgICAgICBrZXlwcmVzcy5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIGluc3RhbmNlLkZ1bGxTY3JlZW4udG9nZ2xlKCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIFwiYmVmb3JlQ2xvc2UuZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UpIHtcbiAgICAgIGlmIChpbnN0YW5jZSAmJiBpbnN0YW5jZS5GdWxsU2NyZWVuICYmIGluc3RhbmNlLiRyZWZzLmNvbnRhaW5lci5oYXNDbGFzcyhcImZhbmN5Ym94LWlzLWZ1bGxzY3JlZW5cIikpIHtcbiAgICAgICAgRnVsbFNjcmVlbi5leGl0KCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICAkKGRvY3VtZW50KS5vbihmbi5mdWxsc2NyZWVuY2hhbmdlLCBmdW5jdGlvbigpIHtcbiAgICB2YXIgaXNGdWxsc2NyZWVuID0gRnVsbFNjcmVlbi5pc0Z1bGxzY3JlZW4oKSxcbiAgICAgIGluc3RhbmNlID0gJC5mYW5jeWJveC5nZXRJbnN0YW5jZSgpO1xuXG4gICAgaWYgKGluc3RhbmNlKSB7XG4gICAgICAvLyBJZiBpbWFnZSBpcyB6b29taW5nLCB0aGVuIGZvcmNlIHRvIHN0b3AgYW5kIHJlcG9zaXRpb24gcHJvcGVybHlcbiAgICAgIGlmIChpbnN0YW5jZS5jdXJyZW50ICYmIGluc3RhbmNlLmN1cnJlbnQudHlwZSA9PT0gXCJpbWFnZVwiICYmIGluc3RhbmNlLmlzQW5pbWF0aW5nKSB7XG4gICAgICAgIGluc3RhbmNlLmN1cnJlbnQuJGNvbnRlbnQuY3NzKFwidHJhbnNpdGlvblwiLCBcIm5vbmVcIik7XG5cbiAgICAgICAgaW5zdGFuY2UuaXNBbmltYXRpbmcgPSBmYWxzZTtcblxuICAgICAgICBpbnN0YW5jZS51cGRhdGUodHJ1ZSwgdHJ1ZSwgMCk7XG4gICAgICB9XG5cbiAgICAgIGluc3RhbmNlLnRyaWdnZXIoXCJvbkZ1bGxzY3JlZW5DaGFuZ2VcIiwgaXNGdWxsc2NyZWVuKTtcblxuICAgICAgaW5zdGFuY2UuJHJlZnMuY29udGFpbmVyLnRvZ2dsZUNsYXNzKFwiZmFuY3lib3gtaXMtZnVsbHNjcmVlblwiLCBpc0Z1bGxzY3JlZW4pO1xuICAgIH1cbiAgfSk7XG59KShkb2N1bWVudCwgd2luZG93LmpRdWVyeSB8fCBqUXVlcnkpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy9cbi8vIFRodW1ic1xuLy8gRGlzcGxheXMgdGh1bWJuYWlscyBpbiBhIGdyaWRcbi8vXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuKGZ1bmN0aW9uKGRvY3VtZW50LCAkKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBDTEFTUyA9IFwiZmFuY3lib3gtdGh1bWJzXCIsXG4gICAgQ0xBU1NfQUNUSVZFID0gQ0xBU1MgKyBcIi1hY3RpdmVcIixcbiAgICBDTEFTU19MT0FEID0gQ0xBU1MgKyBcIi1sb2FkaW5nXCI7XG5cbiAgLy8gTWFrZSBzdXJlIHRoZXJlIGFyZSBkZWZhdWx0IHZhbHVlc1xuICAkLmZhbmN5Ym94LmRlZmF1bHRzID0gJC5leHRlbmQoXG4gICAgdHJ1ZSxcbiAgICB7XG4gICAgICBidG5UcGw6IHtcbiAgICAgICAgdGh1bWJzOlxuICAgICAgICAgICc8YnV0dG9uIGRhdGEtZmFuY3lib3gtdGh1bWJzIGNsYXNzPVwiZmFuY3lib3gtYnV0dG9uIGZhbmN5Ym94LWJ1dHRvbi0tdGh1bWJzXCIgdGl0bGU9XCJ7e1RIVU1CU319XCI+JyArXG4gICAgICAgICAgJzxzdmcgdmlld0JveD1cIjAgMCAxMjAgMTIwXCI+JyArXG4gICAgICAgICAgJzxwYXRoIGQ9XCJNMzAsMzAgaDE0IHYxNCBoLTE0IFogTTUwLDMwIGgxNCB2MTQgaC0xNCBaIE03MCwzMCBoMTQgdjE0IGgtMTQgWiBNMzAsNTAgaDE0IHYxNCBoLTE0IFogTTUwLDUwIGgxNCB2MTQgaC0xNCBaIE03MCw1MCBoMTQgdjE0IGgtMTQgWiBNMzAsNzAgaDE0IHYxNCBoLTE0IFogTTUwLDcwIGgxNCB2MTQgaC0xNCBaIE03MCw3MCBoMTQgdjE0IGgtMTQgWlwiIC8+JyArXG4gICAgICAgICAgXCI8L3N2Zz5cIiArXG4gICAgICAgICAgXCI8L2J1dHRvbj5cIlxuICAgICAgfSxcbiAgICAgIHRodW1iczoge1xuICAgICAgICBhdXRvU3RhcnQ6IGZhbHNlLCAvLyBEaXNwbGF5IHRodW1ibmFpbHMgb24gb3BlbmluZ1xuICAgICAgICBoaWRlT25DbG9zZTogdHJ1ZSwgLy8gSGlkZSB0aHVtYm5haWwgZ3JpZCB3aGVuIGNsb3NpbmcgYW5pbWF0aW9uIHN0YXJ0c1xuICAgICAgICBwYXJlbnRFbDogXCIuZmFuY3lib3gtY29udGFpbmVyXCIsIC8vIENvbnRhaW5lciBpcyBpbmplY3RlZCBpbnRvIHRoaXMgZWxlbWVudFxuICAgICAgICBheGlzOiBcInlcIiAvLyBWZXJ0aWNhbCAoeSkgb3IgaG9yaXpvbnRhbCAoeCkgc2Nyb2xsaW5nXG4gICAgICB9XG4gICAgfSxcbiAgICAkLmZhbmN5Ym94LmRlZmF1bHRzXG4gICk7XG5cbiAgdmFyIEZhbmN5VGh1bWJzID0gZnVuY3Rpb24oaW5zdGFuY2UpIHtcbiAgICB0aGlzLmluaXQoaW5zdGFuY2UpO1xuICB9O1xuXG4gICQuZXh0ZW5kKEZhbmN5VGh1bWJzLnByb3RvdHlwZSwge1xuICAgICRidXR0b246IG51bGwsXG4gICAgJGdyaWQ6IG51bGwsXG4gICAgJGxpc3Q6IG51bGwsXG4gICAgaXNWaXNpYmxlOiBmYWxzZSxcbiAgICBpc0FjdGl2ZTogZmFsc2UsXG5cbiAgICBpbml0OiBmdW5jdGlvbihpbnN0YW5jZSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICBmaXJzdCxcbiAgICAgICAgc2Vjb25kO1xuXG4gICAgICBzZWxmLmluc3RhbmNlID0gaW5zdGFuY2U7XG5cbiAgICAgIGluc3RhbmNlLlRodW1icyA9IHNlbGY7XG5cbiAgICAgIHNlbGYub3B0cyA9IGluc3RhbmNlLmdyb3VwW2luc3RhbmNlLmN1cnJJbmRleF0ub3B0cy50aHVtYnM7XG5cbiAgICAgIC8vIEVuYWJsZSB0aHVtYnMgaWYgYXQgbGVhc3QgdHdvIGdyb3VwIGl0ZW1zIGhhdmUgdGh1bWJuYWlsc1xuICAgICAgZmlyc3QgPSBpbnN0YW5jZS5ncm91cFswXTtcbiAgICAgIGZpcnN0ID0gZmlyc3Qub3B0cy50aHVtYiB8fCAoZmlyc3Qub3B0cy4kdGh1bWIgJiYgZmlyc3Qub3B0cy4kdGh1bWIubGVuZ3RoID8gZmlyc3Qub3B0cy4kdGh1bWIuYXR0cihcInNyY1wiKSA6IGZhbHNlKTtcblxuICAgICAgaWYgKGluc3RhbmNlLmdyb3VwLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgc2Vjb25kID0gaW5zdGFuY2UuZ3JvdXBbMV07XG4gICAgICAgIHNlY29uZCA9IHNlY29uZC5vcHRzLnRodW1iIHx8IChzZWNvbmQub3B0cy4kdGh1bWIgJiYgc2Vjb25kLm9wdHMuJHRodW1iLmxlbmd0aCA/IHNlY29uZC5vcHRzLiR0aHVtYi5hdHRyKFwic3JjXCIpIDogZmFsc2UpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLiRidXR0b24gPSBpbnN0YW5jZS4kcmVmcy50b29sYmFyLmZpbmQoXCJbZGF0YS1mYW5jeWJveC10aHVtYnNdXCIpO1xuXG4gICAgICBpZiAoc2VsZi5vcHRzICYmIGZpcnN0ICYmIHNlY29uZCAmJiBmaXJzdCAmJiBzZWNvbmQpIHtcbiAgICAgICAgc2VsZi4kYnV0dG9uLnNob3coKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHNlbGYudG9nZ2xlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHNlbGYuaXNBY3RpdmUgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc2VsZi4kYnV0dG9uLmhpZGUoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgY3JlYXRlOiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgaW5zdGFuY2UgPSBzZWxmLmluc3RhbmNlLFxuICAgICAgICBwYXJlbnRFbCA9IHNlbGYub3B0cy5wYXJlbnRFbCxcbiAgICAgICAgbGlzdCA9IFtdLFxuICAgICAgICBzcmM7XG5cbiAgICAgIGlmICghc2VsZi4kZ3JpZCkge1xuICAgICAgICAvLyBDcmVhdGUgbWFpbiBlbGVtZW50XG4gICAgICAgIHNlbGYuJGdyaWQgPSAkKCc8ZGl2IGNsYXNzPVwiJyArIENMQVNTICsgXCIgXCIgKyBDTEFTUyArIFwiLVwiICsgc2VsZi5vcHRzLmF4aXMgKyAnXCI+PC9kaXY+JykuYXBwZW5kVG8oXG4gICAgICAgICAgaW5zdGFuY2UuJHJlZnMuY29udGFpbmVyXG4gICAgICAgICAgICAuZmluZChwYXJlbnRFbClcbiAgICAgICAgICAgIC5hZGRCYWNrKClcbiAgICAgICAgICAgIC5maWx0ZXIocGFyZW50RWwpXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gQWRkIFwiY2xpY2tcIiBldmVudCB0aGF0IHBlcmZvcm1zIGdhbGxlcnkgbmF2aWdhdGlvblxuICAgICAgICBzZWxmLiRncmlkLm9uKFwiY2xpY2tcIiwgXCJsaVwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpbnN0YW5jZS5qdW1wVG8oJCh0aGlzKS5hdHRyKFwiZGF0YS1pbmRleFwiKSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBCdWlsZCB0aGUgbGlzdFxuICAgICAgaWYgKCFzZWxmLiRsaXN0KSB7XG4gICAgICAgIHNlbGYuJGxpc3QgPSAkKFwiPHVsPlwiKS5hcHBlbmRUbyhzZWxmLiRncmlkKTtcbiAgICAgIH1cblxuICAgICAgJC5lYWNoKGluc3RhbmNlLmdyb3VwLCBmdW5jdGlvbihpLCBpdGVtKSB7XG4gICAgICAgIHNyYyA9IGl0ZW0ub3B0cy50aHVtYiB8fCAoaXRlbS5vcHRzLiR0aHVtYiA/IGl0ZW0ub3B0cy4kdGh1bWIuYXR0cihcInNyY1wiKSA6IG51bGwpO1xuXG4gICAgICAgIGlmICghc3JjICYmIGl0ZW0udHlwZSA9PT0gXCJpbWFnZVwiKSB7XG4gICAgICAgICAgc3JjID0gaXRlbS5zcmM7XG4gICAgICAgIH1cblxuICAgICAgICBsaXN0LnB1c2goXG4gICAgICAgICAgJzxsaSBkYXRhLWluZGV4PVwiJyArXG4gICAgICAgICAgICBpICtcbiAgICAgICAgICAgICdcIiB0YWJpbmRleD1cIjBcIiBjbGFzcz1cIicgK1xuICAgICAgICAgICAgQ0xBU1NfTE9BRCArXG4gICAgICAgICAgICAnXCInICtcbiAgICAgICAgICAgIChzcmMgJiYgc3JjLmxlbmd0aCA/ICcgc3R5bGU9XCJiYWNrZ3JvdW5kLWltYWdlOnVybCgnICsgc3JjICsgJylcIiAvPicgOiBcIlwiKSArXG4gICAgICAgICAgICBcIj48L2xpPlwiXG4gICAgICAgICk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi4kbGlzdFswXS5pbm5lckhUTUwgPSBsaXN0LmpvaW4oXCJcIik7XG5cbiAgICAgIGlmIChzZWxmLm9wdHMuYXhpcyA9PT0gXCJ4XCIpIHtcbiAgICAgICAgLy8gU2V0IGZpeGVkIHdpZHRoIGZvciBsaXN0IGVsZW1lbnQgdG8gZW5hYmxlIGhvcml6b250YWwgc2Nyb2xsaW5nXG4gICAgICAgIHNlbGYuJGxpc3Qud2lkdGgoXG4gICAgICAgICAgcGFyc2VJbnQoc2VsZi4kZ3JpZC5jc3MoXCJwYWRkaW5nLXJpZ2h0XCIpLCAxMCkgK1xuICAgICAgICAgICAgaW5zdGFuY2UuZ3JvdXAubGVuZ3RoICpcbiAgICAgICAgICAgICAgc2VsZi4kbGlzdFxuICAgICAgICAgICAgICAgIC5jaGlsZHJlbigpXG4gICAgICAgICAgICAgICAgLmVxKDApXG4gICAgICAgICAgICAgICAgLm91dGVyV2lkdGgodHJ1ZSlcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgZm9jdXM6IGZ1bmN0aW9uKGR1cmF0aW9uKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICAgICRsaXN0ID0gc2VsZi4kbGlzdCxcbiAgICAgICAgJGdyaWQgPSBzZWxmLiRncmlkLFxuICAgICAgICB0aHVtYixcbiAgICAgICAgdGh1bWJQb3M7XG5cbiAgICAgIGlmICghc2VsZi5pbnN0YW5jZS5jdXJyZW50KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGh1bWIgPSAkbGlzdFxuICAgICAgICAuY2hpbGRyZW4oKVxuICAgICAgICAucmVtb3ZlQ2xhc3MoQ0xBU1NfQUNUSVZFKVxuICAgICAgICAuZmlsdGVyKCdbZGF0YS1pbmRleD1cIicgKyBzZWxmLmluc3RhbmNlLmN1cnJlbnQuaW5kZXggKyAnXCJdJylcbiAgICAgICAgLmFkZENsYXNzKENMQVNTX0FDVElWRSk7XG5cbiAgICAgIHRodW1iUG9zID0gdGh1bWIucG9zaXRpb24oKTtcblxuICAgICAgLy8gQ2hlY2sgaWYgbmVlZCB0byBzY3JvbGwgdG8gbWFrZSBjdXJyZW50IHRodW1iIHZpc2libGVcbiAgICAgIGlmIChzZWxmLm9wdHMuYXhpcyA9PT0gXCJ5XCIgJiYgKHRodW1iUG9zLnRvcCA8IDAgfHwgdGh1bWJQb3MudG9wID4gJGxpc3QuaGVpZ2h0KCkgLSB0aHVtYi5vdXRlckhlaWdodCgpKSkge1xuICAgICAgICAkbGlzdC5zdG9wKCkuYW5pbWF0ZShcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzY3JvbGxUb3A6ICRsaXN0LnNjcm9sbFRvcCgpICsgdGh1bWJQb3MudG9wXG4gICAgICAgICAgfSxcbiAgICAgICAgICBkdXJhdGlvblxuICAgICAgICApO1xuICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgc2VsZi5vcHRzLmF4aXMgPT09IFwieFwiICYmXG4gICAgICAgICh0aHVtYlBvcy5sZWZ0IDwgJGdyaWQuc2Nyb2xsTGVmdCgpIHx8IHRodW1iUG9zLmxlZnQgPiAkZ3JpZC5zY3JvbGxMZWZ0KCkgKyAoJGdyaWQud2lkdGgoKSAtIHRodW1iLm91dGVyV2lkdGgoKSkpXG4gICAgICApIHtcbiAgICAgICAgJGxpc3RcbiAgICAgICAgICAucGFyZW50KClcbiAgICAgICAgICAuc3RvcCgpXG4gICAgICAgICAgLmFuaW1hdGUoXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHNjcm9sbExlZnQ6IHRodW1iUG9zLmxlZnRcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkdXJhdGlvblxuICAgICAgICAgICk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIHVwZGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgICB0aGF0Lmluc3RhbmNlLiRyZWZzLmNvbnRhaW5lci50b2dnbGVDbGFzcyhcImZhbmN5Ym94LXNob3ctdGh1bWJzXCIsIHRoaXMuaXNWaXNpYmxlKTtcblxuICAgICAgaWYgKHRoYXQuaXNWaXNpYmxlKSB7XG4gICAgICAgIGlmICghdGhhdC4kZ3JpZCkge1xuICAgICAgICAgIHRoYXQuY3JlYXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGF0Lmluc3RhbmNlLnRyaWdnZXIoXCJvblRodW1ic1Nob3dcIik7XG5cbiAgICAgICAgdGhhdC5mb2N1cygwKTtcbiAgICAgIH0gZWxzZSBpZiAodGhhdC4kZ3JpZCkge1xuICAgICAgICB0aGF0Lmluc3RhbmNlLnRyaWdnZXIoXCJvblRodW1ic0hpZGVcIik7XG4gICAgICB9XG5cbiAgICAgIC8vIFVwZGF0ZSBjb250ZW50IHBvc2l0aW9uXG4gICAgICB0aGF0Lmluc3RhbmNlLnVwZGF0ZSgpO1xuICAgIH0sXG5cbiAgICBoaWRlOiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuaXNWaXNpYmxlID0gZmFsc2U7XG4gICAgICB0aGlzLnVwZGF0ZSgpO1xuICAgIH0sXG5cbiAgICBzaG93OiBmdW5jdGlvbigpIHtcbiAgICAgIHRoaXMuaXNWaXNpYmxlID0gdHJ1ZTtcbiAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgfSxcblxuICAgIHRvZ2dsZTogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLmlzVmlzaWJsZSA9ICF0aGlzLmlzVmlzaWJsZTtcbiAgICAgIHRoaXMudXBkYXRlKCk7XG4gICAgfVxuICB9KTtcblxuICAkKGRvY3VtZW50KS5vbih7XG4gICAgXCJvbkluaXQuZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UpIHtcbiAgICAgIHZhciBUaHVtYnM7XG5cbiAgICAgIGlmIChpbnN0YW5jZSAmJiAhaW5zdGFuY2UuVGh1bWJzKSB7XG4gICAgICAgIFRodW1icyA9IG5ldyBGYW5jeVRodW1icyhpbnN0YW5jZSk7XG5cbiAgICAgICAgaWYgKFRodW1icy5pc0FjdGl2ZSAmJiBUaHVtYnMub3B0cy5hdXRvU3RhcnQgPT09IHRydWUpIHtcbiAgICAgICAgICBUaHVtYnMuc2hvdygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIFwiYmVmb3JlU2hvdy5mYlwiOiBmdW5jdGlvbihlLCBpbnN0YW5jZSwgaXRlbSwgZmlyc3RSdW4pIHtcbiAgICAgIHZhciBUaHVtYnMgPSBpbnN0YW5jZSAmJiBpbnN0YW5jZS5UaHVtYnM7XG5cbiAgICAgIGlmIChUaHVtYnMgJiYgVGh1bWJzLmlzVmlzaWJsZSkge1xuICAgICAgICBUaHVtYnMuZm9jdXMoZmlyc3RSdW4gPyAwIDogMjUwKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJhZnRlcktleWRvd24uZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UsIGN1cnJlbnQsIGtleXByZXNzLCBrZXljb2RlKSB7XG4gICAgICB2YXIgVGh1bWJzID0gaW5zdGFuY2UgJiYgaW5zdGFuY2UuVGh1bWJzO1xuXG4gICAgICAvLyBcIkdcIlxuICAgICAgaWYgKFRodW1icyAmJiBUaHVtYnMuaXNBY3RpdmUgJiYga2V5Y29kZSA9PT0gNzEpIHtcbiAgICAgICAga2V5cHJlc3MucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBUaHVtYnMudG9nZ2xlKCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIFwiYmVmb3JlQ2xvc2UuZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UpIHtcbiAgICAgIHZhciBUaHVtYnMgPSBpbnN0YW5jZSAmJiBpbnN0YW5jZS5UaHVtYnM7XG5cbiAgICAgIGlmIChUaHVtYnMgJiYgVGh1bWJzLmlzVmlzaWJsZSAmJiBUaHVtYnMub3B0cy5oaWRlT25DbG9zZSAhPT0gZmFsc2UpIHtcbiAgICAgICAgVGh1bWJzLiRncmlkLmhpZGUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufSkoZG9jdW1lbnQsIHdpbmRvdy5qUXVlcnkgfHwgalF1ZXJ5KTtcblxuLy8vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy9cbi8vIFNoYXJlXG4vLyBEaXNwbGF5cyBzaW1wbGUgZm9ybSBmb3Igc2hhcmluZyBjdXJyZW50IHVybFxuLy9cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4oZnVuY3Rpb24oZG9jdW1lbnQsICQpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgJC5leHRlbmQodHJ1ZSwgJC5mYW5jeWJveC5kZWZhdWx0cywge1xuICAgIGJ0blRwbDoge1xuICAgICAgc2hhcmU6XG4gICAgICAgICc8YnV0dG9uIGRhdGEtZmFuY3lib3gtc2hhcmUgY2xhc3M9XCJmYW5jeWJveC1idXR0b24gZmFuY3lib3gtYnV0dG9uLS1zaGFyZVwiIHRpdGxlPVwie3tTSEFSRX19XCI+JyArXG4gICAgICAgICc8c3ZnIHZpZXdCb3g9XCIwIDAgNDAgNDBcIj4nICtcbiAgICAgICAgJzxwYXRoIGQ9XCJNNiwzMCBDOCwxOCAxOSwxNiAyMywxNiBMMjMsMTYgTDIzLDEwIEwzMywyMCBMMjMsMjkgTDIzLDI0IEMxOSwyNCA4LDI3IDYsMzAgWlwiPicgK1xuICAgICAgICBcIjwvc3ZnPlwiICtcbiAgICAgICAgXCI8L2J1dHRvbj5cIlxuICAgIH0sXG4gICAgc2hhcmU6IHtcbiAgICAgIHVybDogZnVuY3Rpb24oaW5zdGFuY2UsIGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAoIWluc3RhbmNlLmN1cnJlbnRIYXNoICYmICEoaXRlbS50eXBlID09PSBcImlubGluZVwiIHx8IGl0ZW0udHlwZSA9PT0gXCJodG1sXCIpID8gaXRlbS5vcmlnU3JjIHx8IGl0ZW0uc3JjIDogZmFsc2UpIHx8IHdpbmRvdy5sb2NhdGlvblxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIHRwbDpcbiAgICAgICAgJzxkaXYgY2xhc3M9XCJmYW5jeWJveC1zaGFyZVwiPicgK1xuICAgICAgICBcIjxoMT57e1NIQVJFfX08L2gxPlwiICtcbiAgICAgICAgXCI8cD5cIiArXG4gICAgICAgICc8YSBjbGFzcz1cImZhbmN5Ym94LXNoYXJlX19idXR0b24gZmFuY3lib3gtc2hhcmVfX2J1dHRvbi0tZmJcIiBocmVmPVwiaHR0cHM6Ly93d3cuZmFjZWJvb2suY29tL3NoYXJlci9zaGFyZXIucGhwP3U9e3t1cmx9fVwiPicgK1xuICAgICAgICAnPHN2ZyB2aWV3Qm94PVwiMCAwIDUxMiA1MTJcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+PHBhdGggZD1cIm0yODcgNDU2di0yOTljMC0yMSA2LTM1IDM1LTM1aDM4di02M2MtNy0xLTI5LTMtNTUtMy01NCAwLTkxIDMzLTkxIDk0djMwNm0xNDMtMjU0aC0yMDV2NzJoMTk2XCIgLz48L3N2Zz4nICtcbiAgICAgICAgXCI8c3Bhbj5GYWNlYm9vazwvc3Bhbj5cIiArXG4gICAgICAgIFwiPC9hPlwiICtcbiAgICAgICAgJzxhIGNsYXNzPVwiZmFuY3lib3gtc2hhcmVfX2J1dHRvbiBmYW5jeWJveC1zaGFyZV9fYnV0dG9uLS10d1wiIGhyZWY9XCJodHRwczovL3R3aXR0ZXIuY29tL2ludGVudC90d2VldD91cmw9e3t1cmx9fSZ0ZXh0PXt7ZGVzY3J9fVwiPicgK1xuICAgICAgICAnPHN2ZyB2aWV3Qm94PVwiMCAwIDUxMiA1MTJcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCI+PHBhdGggZD1cIm00NTYgMTMzYy0xNCA3LTMxIDExLTQ3IDEzIDE3LTEwIDMwLTI3IDM3LTQ2LTE1IDEwLTM0IDE2LTUyIDIwLTYxLTYyLTE1Ny03LTE0MSA3NS02OC0zLTEyOS0zNS0xNjktODUtMjIgMzctMTEgODYgMjYgMTA5LTEzIDAtMjYtNC0zNy05IDAgMzkgMjggNzIgNjUgODAtMTIgMy0yNSA0LTM3IDIgMTAgMzMgNDEgNTcgNzcgNTctNDIgMzAtNzcgMzgtMTIyIDM0IDE3MCAxMTEgMzc4LTMyIDM1OS0yMDggMTYtMTEgMzAtMjUgNDEtNDJ6XCIgLz48L3N2Zz4nICtcbiAgICAgICAgXCI8c3Bhbj5Ud2l0dGVyPC9zcGFuPlwiICtcbiAgICAgICAgXCI8L2E+XCIgK1xuICAgICAgICAnPGEgY2xhc3M9XCJmYW5jeWJveC1zaGFyZV9fYnV0dG9uIGZhbmN5Ym94LXNoYXJlX19idXR0b24tLXB0XCIgaHJlZj1cImh0dHBzOi8vd3d3LnBpbnRlcmVzdC5jb20vcGluL2NyZWF0ZS9idXR0b24vP3VybD17e3VybH19JmRlc2NyaXB0aW9uPXt7ZGVzY3J9fSZtZWRpYT17e21lZGlhfX1cIj4nICtcbiAgICAgICAgJzxzdmcgdmlld0JveD1cIjAgMCA1MTIgNTEyXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPjxwYXRoIGQ9XCJtMjY1IDU2Yy0xMDkgMC0xNjQgNzgtMTY0IDE0NCAwIDM5IDE1IDc0IDQ3IDg3IDUgMiAxMCAwIDEyLTVsNC0xOWMyLTYgMS04LTMtMTMtOS0xMS0xNS0yNS0xNS00NSAwLTU4IDQzLTExMCAxMTMtMTEwIDYyIDAgOTYgMzggOTYgODggMCA2Ny0zMCAxMjItNzMgMTIyLTI0IDAtNDItMTktMzYtNDQgNi0yOSAyMC02MCAyMC04MSAwLTE5LTEwLTM1LTMxLTM1LTI1IDAtNDQgMjYtNDQgNjAgMCAyMSA3IDM2IDcgMzZsLTMwIDEyNWMtOCAzNy0xIDgzIDAgODcgMCAzIDQgNCA1IDIgMi0zIDMyLTM5IDQyLTc1bDE2LTY0YzggMTYgMzEgMjkgNTYgMjkgNzQgMCAxMjQtNjcgMTI0LTE1NyAwLTY5LTU4LTEzMi0xNDYtMTMyelwiIGZpbGw9XCIjZmZmXCIvPjwvc3ZnPicgK1xuICAgICAgICBcIjxzcGFuPlBpbnRlcmVzdDwvc3Bhbj5cIiArXG4gICAgICAgIFwiPC9hPlwiICtcbiAgICAgICAgXCI8L3A+XCIgK1xuICAgICAgICAnPHA+PGlucHV0IGNsYXNzPVwiZmFuY3lib3gtc2hhcmVfX2lucHV0XCIgdHlwZT1cInRleHRcIiB2YWx1ZT1cInt7dXJsX3Jhd319XCIgLz48L3A+JyArXG4gICAgICAgIFwiPC9kaXY+XCJcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGVzY2FwZUh0bWwoc3RyaW5nKSB7XG4gICAgdmFyIGVudGl0eU1hcCA9IHtcbiAgICAgIFwiJlwiOiBcIiZhbXA7XCIsXG4gICAgICBcIjxcIjogXCImbHQ7XCIsXG4gICAgICBcIj5cIjogXCImZ3Q7XCIsXG4gICAgICAnXCInOiBcIiZxdW90O1wiLFxuICAgICAgXCInXCI6IFwiJiMzOTtcIixcbiAgICAgIFwiL1wiOiBcIiYjeDJGO1wiLFxuICAgICAgXCJgXCI6IFwiJiN4NjA7XCIsXG4gICAgICBcIj1cIjogXCImI3gzRDtcIlxuICAgIH07XG5cbiAgICByZXR1cm4gU3RyaW5nKHN0cmluZykucmVwbGFjZSgvWyY8PlwiJ2A9XFwvXS9nLCBmdW5jdGlvbihzKSB7XG4gICAgICByZXR1cm4gZW50aXR5TWFwW3NdO1xuICAgIH0pO1xuICB9XG5cbiAgJChkb2N1bWVudCkub24oXCJjbGlja1wiLCBcIltkYXRhLWZhbmN5Ym94LXNoYXJlXVwiLCBmdW5jdGlvbigpIHtcbiAgICB2YXIgaW5zdGFuY2UgPSAkLmZhbmN5Ym94LmdldEluc3RhbmNlKCksXG4gICAgICBjdXJyZW50ID0gaW5zdGFuY2UuY3VycmVudCB8fCBudWxsLFxuICAgICAgdXJsLFxuICAgICAgdHBsO1xuXG4gICAgaWYgKCFjdXJyZW50KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCQudHlwZShjdXJyZW50Lm9wdHMuc2hhcmUudXJsKSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICB1cmwgPSBjdXJyZW50Lm9wdHMuc2hhcmUudXJsLmFwcGx5KGN1cnJlbnQsIFtpbnN0YW5jZSwgY3VycmVudF0pO1xuICAgIH1cblxuICAgIHRwbCA9IGN1cnJlbnQub3B0cy5zaGFyZS50cGxcbiAgICAgIC5yZXBsYWNlKC9cXHtcXHttZWRpYVxcfVxcfS9nLCBjdXJyZW50LnR5cGUgPT09IFwiaW1hZ2VcIiA/IGVuY29kZVVSSUNvbXBvbmVudChjdXJyZW50LnNyYykgOiBcIlwiKVxuICAgICAgLnJlcGxhY2UoL1xce1xce3VybFxcfVxcfS9nLCBlbmNvZGVVUklDb21wb25lbnQodXJsKSlcbiAgICAgIC5yZXBsYWNlKC9cXHtcXHt1cmxfcmF3XFx9XFx9L2csIGVzY2FwZUh0bWwodXJsKSlcbiAgICAgIC5yZXBsYWNlKC9cXHtcXHtkZXNjclxcfVxcfS9nLCBpbnN0YW5jZS4kY2FwdGlvbiA/IGVuY29kZVVSSUNvbXBvbmVudChpbnN0YW5jZS4kY2FwdGlvbi50ZXh0KCkpIDogXCJcIik7XG5cbiAgICAkLmZhbmN5Ym94Lm9wZW4oe1xuICAgICAgc3JjOiBpbnN0YW5jZS50cmFuc2xhdGUoaW5zdGFuY2UsIHRwbCksXG4gICAgICB0eXBlOiBcImh0bWxcIixcbiAgICAgIG9wdHM6IHtcbiAgICAgICAgYW5pbWF0aW9uRWZmZWN0OiBmYWxzZSxcbiAgICAgICAgYWZ0ZXJMb2FkOiBmdW5jdGlvbihzaGFyZUluc3RhbmNlLCBzaGFyZUN1cnJlbnQpIHtcbiAgICAgICAgICAvLyBDbG9zZSBzZWxmIGlmIHBhcmVudCBpbnN0YW5jZSBpcyBjbG9zaW5nXG4gICAgICAgICAgaW5zdGFuY2UuJHJlZnMuY29udGFpbmVyLm9uZShcImJlZm9yZUNsb3NlLmZiXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2hhcmVJbnN0YW5jZS5jbG9zZShudWxsLCAwKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIE9wZW5pbmcgbGlua3MgaW4gYSBwb3B1cCB3aW5kb3dcbiAgICAgICAgICBzaGFyZUN1cnJlbnQuJGNvbnRlbnQuZmluZChcIi5mYW5jeWJveC1zaGFyZV9fbGlua3MgYVwiKS5jbGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHdpbmRvdy5vcGVuKHRoaXMuaHJlZiwgXCJTaGFyZVwiLCBcIndpZHRoPTU1MCwgaGVpZ2h0PTQ1MFwiKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn0pKGRvY3VtZW50LCB3aW5kb3cualF1ZXJ5IHx8IGpRdWVyeSk7XG5cbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vL1xuLy8gSGFzaFxuLy8gRW5hYmxlcyBsaW5raW5nIHRvIGVhY2ggbW9kYWxcbi8vXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuKGZ1bmN0aW9uKGRvY3VtZW50LCB3aW5kb3csICQpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgLy8gU2ltcGxlICQuZXNjYXBlU2VsZWN0b3IgcG9seWZpbGwgKGZvciBqUXVlcnkgcHJpb3IgdjMpXG4gIGlmICghJC5lc2NhcGVTZWxlY3Rvcikge1xuICAgICQuZXNjYXBlU2VsZWN0b3IgPSBmdW5jdGlvbihzZWwpIHtcbiAgICAgIHZhciByY3NzZXNjYXBlID0gLyhbXFwwLVxceDFmXFx4N2ZdfF4tP1xcZCl8Xi0kfFteXFx4ODAtXFx1RkZGRlxcdy1dL2c7XG4gICAgICB2YXIgZmNzc2VzY2FwZSA9IGZ1bmN0aW9uKGNoLCBhc0NvZGVQb2ludCkge1xuICAgICAgICBpZiAoYXNDb2RlUG9pbnQpIHtcbiAgICAgICAgICAvLyBVKzAwMDAgTlVMTCBiZWNvbWVzIFUrRkZGRCBSRVBMQUNFTUVOVCBDSEFSQUNURVJcbiAgICAgICAgICBpZiAoY2ggPT09IFwiXFwwXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBcIlxcdUZGRkRcIjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBDb250cm9sIGNoYXJhY3RlcnMgYW5kIChkZXBlbmRlbnQgdXBvbiBwb3NpdGlvbikgbnVtYmVycyBnZXQgZXNjYXBlZCBhcyBjb2RlIHBvaW50c1xuICAgICAgICAgIHJldHVybiBjaC5zbGljZSgwLCAtMSkgKyBcIlxcXFxcIiArIGNoLmNoYXJDb2RlQXQoY2gubGVuZ3RoIC0gMSkudG9TdHJpbmcoMTYpICsgXCIgXCI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPdGhlciBwb3RlbnRpYWxseS1zcGVjaWFsIEFTQ0lJIGNoYXJhY3RlcnMgZ2V0IGJhY2tzbGFzaC1lc2NhcGVkXG4gICAgICAgIHJldHVybiBcIlxcXFxcIiArIGNoO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIChzZWwgKyBcIlwiKS5yZXBsYWNlKHJjc3Nlc2NhcGUsIGZjc3Nlc2NhcGUpO1xuICAgIH07XG4gIH1cblxuICAvLyBHZXQgaW5mbyBhYm91dCBnYWxsZXJ5IG5hbWUgYW5kIGN1cnJlbnQgaW5kZXggZnJvbSB1cmxcbiAgZnVuY3Rpb24gcGFyc2VVcmwoKSB7XG4gICAgdmFyIGhhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaC5zdWJzdHIoMSksXG4gICAgICByZXogPSBoYXNoLnNwbGl0KFwiLVwiKSxcbiAgICAgIGluZGV4ID0gcmV6Lmxlbmd0aCA+IDEgJiYgL15cXCs/XFxkKyQvLnRlc3QocmV6W3Jlei5sZW5ndGggLSAxXSkgPyBwYXJzZUludChyZXoucG9wKC0xKSwgMTApIHx8IDEgOiAxLFxuICAgICAgZ2FsbGVyeSA9IHJlei5qb2luKFwiLVwiKTtcblxuICAgIHJldHVybiB7XG4gICAgICBoYXNoOiBoYXNoLFxuICAgICAgLyogSW5kZXggaXMgc3RhcnRpbmcgZnJvbSAxICovXG4gICAgICBpbmRleDogaW5kZXggPCAxID8gMSA6IGluZGV4LFxuICAgICAgZ2FsbGVyeTogZ2FsbGVyeVxuICAgIH07XG4gIH1cblxuICAvLyBUcmlnZ2VyIGNsaWNrIGV2bnQgb24gbGlua3MgdG8gb3BlbiBuZXcgZmFuY3lCb3ggaW5zdGFuY2VcbiAgZnVuY3Rpb24gdHJpZ2dlckZyb21VcmwodXJsKSB7XG4gICAgdmFyICRlbDtcblxuICAgIGlmICh1cmwuZ2FsbGVyeSAhPT0gXCJcIikge1xuICAgICAgLy8gSWYgd2UgY2FuIGZpbmQgZWxlbWVudCBtYXRjaGluZyAnZGF0YS1mYW5jeWJveCcgYXRyaWJ1dGUsIHRoZW4gdHJpZ2dlciBjbGljayBldmVudCBmb3IgdGhhdC5cbiAgICAgIC8vIEl0IHNob3VsZCBzdGFydCBmYW5jeUJveFxuICAgICAgJGVsID0gJChcIltkYXRhLWZhbmN5Ym94PSdcIiArICQuZXNjYXBlU2VsZWN0b3IodXJsLmdhbGxlcnkpICsgXCInXVwiKVxuICAgICAgICAuZXEodXJsLmluZGV4IC0gMSlcbiAgICAgICAgLnRyaWdnZXIoXCJjbGljay5mYi1zdGFydFwiKTtcbiAgICB9XG4gIH1cblxuICAvLyBHZXQgZ2FsbGVyeSBuYW1lIGZyb20gY3VycmVudCBpbnN0YW5jZVxuICBmdW5jdGlvbiBnZXRHYWxsZXJ5SUQoaW5zdGFuY2UpIHtcbiAgICB2YXIgb3B0cywgcmV0O1xuXG4gICAgaWYgKCFpbnN0YW5jZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIG9wdHMgPSBpbnN0YW5jZS5jdXJyZW50ID8gaW5zdGFuY2UuY3VycmVudC5vcHRzIDogaW5zdGFuY2Uub3B0cztcbiAgICByZXQgPSBvcHRzLmhhc2ggfHwgKG9wdHMuJG9yaWcgPyBvcHRzLiRvcmlnLmRhdGEoXCJmYW5jeWJveFwiKSA6IFwiXCIpO1xuXG4gICAgcmV0dXJuIHJldCA9PT0gXCJcIiA/IGZhbHNlIDogcmV0O1xuICB9XG5cbiAgLy8gU3RhcnQgd2hlbiBET00gYmVjb21lcyByZWFkeVxuICAkKGZ1bmN0aW9uKCkge1xuICAgIC8vIENoZWNrIGlmIHVzZXIgaGFzIGRpc2FibGVkIHRoaXMgbW9kdWxlXG4gICAgaWYgKCQuZmFuY3lib3guZGVmYXVsdHMuaGFzaCA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBVcGRhdGUgaGFzaCB3aGVuIG9wZW5pbmcvY2xvc2luZyBmYW5jeUJveFxuICAgICQoZG9jdW1lbnQpLm9uKHtcbiAgICAgIFwib25Jbml0LmZiXCI6IGZ1bmN0aW9uKGUsIGluc3RhbmNlKSB7XG4gICAgICAgIHZhciB1cmwsIGdhbGxlcnk7XG5cbiAgICAgICAgaWYgKGluc3RhbmNlLmdyb3VwW2luc3RhbmNlLmN1cnJJbmRleF0ub3B0cy5oYXNoID09PSBmYWxzZSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHVybCA9IHBhcnNlVXJsKCk7XG4gICAgICAgIGdhbGxlcnkgPSBnZXRHYWxsZXJ5SUQoaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vIE1ha2Ugc3VyZSBnYWxsZXJ5IHN0YXJ0IGluZGV4IG1hdGNoZXMgaW5kZXggZnJvbSBoYXNoXG4gICAgICAgIGlmIChnYWxsZXJ5ICYmIHVybC5nYWxsZXJ5ICYmIGdhbGxlcnkgPT0gdXJsLmdhbGxlcnkpIHtcbiAgICAgICAgICBpbnN0YW5jZS5jdXJySW5kZXggPSB1cmwuaW5kZXggLSAxO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICBcImJlZm9yZVNob3cuZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UsIGN1cnJlbnQsIGZpcnN0UnVuKSB7XG4gICAgICAgIHZhciBnYWxsZXJ5O1xuXG4gICAgICAgIGlmICghY3VycmVudCB8fCBjdXJyZW50Lm9wdHMuaGFzaCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiBuZWVkIHRvIHVwZGF0ZSB3aW5kb3cgaGFzaFxuICAgICAgICBnYWxsZXJ5ID0gZ2V0R2FsbGVyeUlEKGluc3RhbmNlKTtcblxuICAgICAgICBpZiAoIWdhbGxlcnkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBWYXJpYWJsZSBjb250YWluaW5nIGxhc3QgaGFzaCB2YWx1ZSBzZXQgYnkgZmFuY3lCb3hcbiAgICAgICAgLy8gSXQgd2lsbCBiZSB1c2VkIHRvIGRldGVybWluZSBpZiBmYW5jeUJveCBuZWVkcyB0byBjbG9zZSBhZnRlciBoYXNoIGNoYW5nZSBpcyBkZXRlY3RlZFxuICAgICAgICBpbnN0YW5jZS5jdXJyZW50SGFzaCA9IGdhbGxlcnkgKyAoaW5zdGFuY2UuZ3JvdXAubGVuZ3RoID4gMSA/IFwiLVwiICsgKGN1cnJlbnQuaW5kZXggKyAxKSA6IFwiXCIpO1xuXG4gICAgICAgIC8vIElmIGN1cnJlbnQgaGFzaCBpcyB0aGUgc2FtZSAodGhpcyBpbnN0YW5jZSBtb3N0IGxpa2VseSBpcyBvcGVuZWQgYnkgaGFzaGNoYW5nZSksIHRoZW4gZG8gbm90aGluZ1xuICAgICAgICBpZiAod2luZG93LmxvY2F0aW9uLmhhc2ggPT09IFwiI1wiICsgaW5zdGFuY2UuY3VycmVudEhhc2gpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWluc3RhbmNlLm9yaWdIYXNoKSB7XG4gICAgICAgICAgaW5zdGFuY2Uub3JpZ0hhc2ggPSB3aW5kb3cubG9jYXRpb24uaGFzaDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbnN0YW5jZS5oYXNoVGltZXIpIHtcbiAgICAgICAgICBjbGVhclRpbWVvdXQoaW5zdGFuY2UuaGFzaFRpbWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSBoYXNoXG4gICAgICAgIGluc3RhbmNlLmhhc2hUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKFwicmVwbGFjZVN0YXRlXCIgaW4gd2luZG93Lmhpc3RvcnkpIHtcbiAgICAgICAgICAgIHdpbmRvdy5oaXN0b3J5W2ZpcnN0UnVuID8gXCJwdXNoU3RhdGVcIiA6IFwicmVwbGFjZVN0YXRlXCJdKFxuICAgICAgICAgICAgICB7fSxcbiAgICAgICAgICAgICAgZG9jdW1lbnQudGl0bGUsXG4gICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSArIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2ggKyBcIiNcIiArIGluc3RhbmNlLmN1cnJlbnRIYXNoXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAoZmlyc3RSdW4pIHtcbiAgICAgICAgICAgICAgaW5zdGFuY2UuaGFzQ3JlYXRlZEhpc3RvcnkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9IGluc3RhbmNlLmN1cnJlbnRIYXNoO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGluc3RhbmNlLmhhc2hUaW1lciA9IG51bGw7XG4gICAgICAgIH0sIDMwMCk7XG4gICAgICB9LFxuXG4gICAgICBcImJlZm9yZUNsb3NlLmZiXCI6IGZ1bmN0aW9uKGUsIGluc3RhbmNlLCBjdXJyZW50KSB7XG4gICAgICAgIHZhciBnYWxsZXJ5O1xuXG4gICAgICAgIGlmIChjdXJyZW50Lm9wdHMuaGFzaCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBnYWxsZXJ5ID0gZ2V0R2FsbGVyeUlEKGluc3RhbmNlKTtcblxuICAgICAgICAvLyBHb3RvIHByZXZpb3VzIGhpc3RvcnkgZW50cnlcbiAgICAgICAgaWYgKGluc3RhbmNlLmN1cnJlbnRIYXNoICYmIGluc3RhbmNlLmhhc0NyZWF0ZWRIaXN0b3J5KSB7XG4gICAgICAgICAgd2luZG93Lmhpc3RvcnkuYmFjaygpO1xuICAgICAgICB9IGVsc2UgaWYgKGluc3RhbmNlLmN1cnJlbnRIYXNoKSB7XG4gICAgICAgICAgaWYgKFwicmVwbGFjZVN0YXRlXCIgaW4gd2luZG93Lmhpc3RvcnkpIHtcbiAgICAgICAgICAgIHdpbmRvdy5oaXN0b3J5LnJlcGxhY2VTdGF0ZSh7fSwgZG9jdW1lbnQudGl0bGUsIHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZSArIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2ggKyAoaW5zdGFuY2Uub3JpZ0hhc2ggfHwgXCJcIikpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB3aW5kb3cubG9jYXRpb24uaGFzaCA9IGluc3RhbmNlLm9yaWdIYXNoO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGluc3RhbmNlLmN1cnJlbnRIYXNoID0gbnVsbDtcblxuICAgICAgICBjbGVhclRpbWVvdXQoaW5zdGFuY2UuaGFzaFRpbWVyKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENoZWNrIGlmIG5lZWQgdG8gc3RhcnQvY2xvc2UgYWZ0ZXIgdXJsIGhhcyBjaGFuZ2VkXG4gICAgJCh3aW5kb3cpLm9uKFwiaGFzaGNoYW5nZS5mYlwiLCBmdW5jdGlvbigpIHtcbiAgICAgIHZhciB1cmwgPSBwYXJzZVVybCgpLFxuICAgICAgICBmYjtcblxuICAgICAgLy8gRmluZCBsYXN0IGZhbmN5Qm94IGluc3RhbmNlIHRoYXQgaGFzIFwiaGFzaFwiXG4gICAgICAkLmVhY2goXG4gICAgICAgICQoXCIuZmFuY3lib3gtY29udGFpbmVyXCIpXG4gICAgICAgICAgLmdldCgpXG4gICAgICAgICAgLnJldmVyc2UoKSxcbiAgICAgICAgZnVuY3Rpb24oaW5kZXgsIHZhbHVlKSB7XG4gICAgICAgICAgdmFyIHRtcCA9ICQodmFsdWUpLmRhdGEoXCJGYW5jeUJveFwiKTtcbiAgICAgICAgICAvL2lzQ2xvc2luZ1xuICAgICAgICAgIGlmICh0bXAuY3VycmVudEhhc2gpIHtcbiAgICAgICAgICAgIGZiID0gdG1wO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgaWYgKGZiKSB7XG4gICAgICAgIC8vIE5vdywgY29tcGFyZSBoYXNoIHZhbHVlc1xuICAgICAgICBpZiAoZmIuY3VycmVudEhhc2ggJiYgZmIuY3VycmVudEhhc2ggIT09IHVybC5nYWxsZXJ5ICsgXCItXCIgKyB1cmwuaW5kZXggJiYgISh1cmwuaW5kZXggPT09IDEgJiYgZmIuY3VycmVudEhhc2ggPT0gdXJsLmdhbGxlcnkpKSB7XG4gICAgICAgICAgZmIuY3VycmVudEhhc2ggPSBudWxsO1xuXG4gICAgICAgICAgZmIuY2xvc2UoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICh1cmwuZ2FsbGVyeSAhPT0gXCJcIikge1xuICAgICAgICB0cmlnZ2VyRnJvbVVybCh1cmwpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gQ2hlY2sgY3VycmVudCBoYXNoIGFuZCB0cmlnZ2VyIGNsaWNrIGV2ZW50IG9uIG1hdGNoaW5nIGVsZW1lbnQgdG8gc3RhcnQgZmFuY3lCb3gsIGlmIG5lZWRlZFxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoISQuZmFuY3lib3guZ2V0SW5zdGFuY2UoKSkge1xuICAgICAgICB0cmlnZ2VyRnJvbVVybChwYXJzZVVybCgpKTtcbiAgICAgIH1cbiAgICB9LCA1MCk7XG4gIH0pO1xufSkoZG9jdW1lbnQsIHdpbmRvdywgd2luZG93LmpRdWVyeSB8fCBqUXVlcnkpO1xuXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy9cbi8vIFdoZWVsXG4vLyBCYXNpYyBtb3VzZSB3ZWhlZWwgc3VwcG9ydCBmb3IgZ2FsbGVyeSBuYXZpZ2F0aW9uXG4vL1xuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbihmdW5jdGlvbihkb2N1bWVudCwgJCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgcHJldlRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuICAkKGRvY3VtZW50KS5vbih7XG4gICAgXCJvbkluaXQuZmJcIjogZnVuY3Rpb24oZSwgaW5zdGFuY2UsIGN1cnJlbnQpIHtcbiAgICAgIGluc3RhbmNlLiRyZWZzLnN0YWdlLm9uKFwibW91c2V3aGVlbCBET01Nb3VzZVNjcm9sbCB3aGVlbCBNb3pNb3VzZVBpeGVsU2Nyb2xsXCIsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdmFyIGN1cnJlbnQgPSBpbnN0YW5jZS5jdXJyZW50LFxuICAgICAgICAgIGN1cnJUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cbiAgICAgICAgaWYgKGluc3RhbmNlLmdyb3VwLmxlbmd0aCA8IDIgfHwgY3VycmVudC5vcHRzLndoZWVsID09PSBmYWxzZSB8fCAoY3VycmVudC5vcHRzLndoZWVsID09PSBcImF1dG9cIiAmJiBjdXJyZW50LnR5cGUgIT09IFwiaW1hZ2VcIikpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAgICAgaWYgKGN1cnJlbnQuJHNsaWRlLmhhc0NsYXNzKFwiZmFuY3lib3gtYW5pbWF0ZWRcIikpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBlID0gZS5vcmlnaW5hbEV2ZW50IHx8IGU7XG5cbiAgICAgICAgaWYgKGN1cnJUaW1lIC0gcHJldlRpbWUgPCAyNTApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBwcmV2VGltZSA9IGN1cnJUaW1lO1xuXG4gICAgICAgIGluc3RhbmNlWygtZS5kZWx0YVkgfHwgLWUuZGVsdGFYIHx8IGUud2hlZWxEZWx0YSB8fCAtZS5kZXRhaWwpIDwgMCA/IFwibmV4dFwiIDogXCJwcmV2aW91c1wiXSgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcbn0pKGRvY3VtZW50LCB3aW5kb3cualF1ZXJ5IHx8IGpRdWVyeSk7XG4iLCIvKiFcbiAqIGpRdWVyeSAmIFplcHRvIExhenkgLSB2MS43LjlcbiAqIGh0dHA6Ly9qcXVlcnkuZWlzYmVoci5kZS9sYXp5L1xuICpcbiAqIENvcHlyaWdodCAyMDEyIC0gMjAxOCwgRGFuaWVsICdFaXNiZWhyJyBLZXJuXG4gKlxuICogRHVhbCBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGFuZCBHUEwtMi4wIGxpY2Vuc2VzOlxuICogaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqIGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy9ncGwtMi4wLmh0bWxcbiAqXG4gKiAkKFwiaW1nLmxhenlcIikubGF6eSgpO1xuICovXG5cbjsoZnVuY3Rpb24od2luZG93LCB1bmRlZmluZWQpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgIC8qKlxuICAgICAqIGxpYnJhcnkgaW5zdGFuY2UgLSBoZXJlIGFuZCBub3QgaW4gY29uc3RydWN0IHRvIGJlIHNob3J0ZXIgaW4gbWluaW1pemF0aW9uXG4gICAgICogQHJldHVybiB2b2lkXG4gICAgICovXG4gICAgdmFyICQgPSB3aW5kb3cualF1ZXJ5IHx8IHdpbmRvdy5aZXB0byxcblxuICAgIC8qKlxuICAgICAqIHVuaXF1ZSBwbHVnaW4gaW5zdGFuY2UgaWQgY291bnRlclxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgbGF6eUluc3RhbmNlSWQgPSAwLFxuXG4gICAgLyoqXG4gICAgICogaGVscGVyIHRvIHJlZ2lzdGVyIHdpbmRvdyBsb2FkIGZvciBqUXVlcnkgM1xuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqLyAgICBcbiAgICB3aW5kb3dMb2FkZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIG1ha2UgbGF6eSBhdmFpbGFibGUgdG8ganF1ZXJ5IC0gYW5kIG1ha2UgaXQgYSBiaXQgbW9yZSBjYXNlLWluc2Vuc2l0aXZlIDopXG4gICAgICogQGFjY2VzcyBwdWJsaWNcbiAgICAgKiBAdHlwZSB7ZnVuY3Rpb259XG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzXG4gICAgICogQHJldHVybiB7TGF6eVBsdWdpbn1cbiAgICAgKi9cbiAgICAkLmZuLkxhenkgPSAkLmZuLmxhenkgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICAgICAgICByZXR1cm4gbmV3IExhenlQbHVnaW4odGhpcywgc2V0dGluZ3MpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBoZWxwZXIgdG8gYWRkIHBsdWdpbnMgdG8gbGF6eSBwcm90b3R5cGUgY29uZmlndXJhdGlvblxuICAgICAqIEBhY2Nlc3MgcHVibGljXG4gICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfEFycmF5fSBuYW1lc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfEFycmF5fGZ1bmN0aW9ufSBbZWxlbWVudHNdXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gbG9hZGVyXG4gICAgICogQHJldHVybiB2b2lkXG4gICAgICovXG4gICAgJC5MYXp5ID0gJC5sYXp5ID0gZnVuY3Rpb24obmFtZXMsIGVsZW1lbnRzLCBsb2FkZXIpIHtcbiAgICAgICAgLy8gbWFrZSBzZWNvbmQgcGFyYW1ldGVyIG9wdGlvbmFsXG4gICAgICAgIGlmICgkLmlzRnVuY3Rpb24oZWxlbWVudHMpKSB7XG4gICAgICAgICAgICBsb2FkZXIgPSBlbGVtZW50cztcbiAgICAgICAgICAgIGVsZW1lbnRzID0gW107XG4gICAgICAgIH1cblxuICAgICAgICAvLyBleGl0IGhlcmUgaWYgcGFyYW1ldGVyIGlzIG5vdCBhIGNhbGxhYmxlIGZ1bmN0aW9uXG4gICAgICAgIGlmICghJC5pc0Z1bmN0aW9uKGxvYWRlcikpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1ha2UgcGFyYW1ldGVycyBhbiBhcnJheSBvZiBuYW1lcyB0byBiZSBzdXJlXG4gICAgICAgIG5hbWVzID0gJC5pc0FycmF5KG5hbWVzKSA/IG5hbWVzIDogW25hbWVzXTtcbiAgICAgICAgZWxlbWVudHMgPSAkLmlzQXJyYXkoZWxlbWVudHMpID8gZWxlbWVudHMgOiBbZWxlbWVudHNdO1xuXG4gICAgICAgIHZhciBjb25maWcgPSBMYXp5UGx1Z2luLnByb3RvdHlwZS5jb25maWcsXG4gICAgICAgICAgICBmb3JjZWQgPSBjb25maWcuX2YgfHwgKGNvbmZpZy5fZiA9IHt9KTtcblxuICAgICAgICAvLyBhZGQgdGhlIGxvYWRlciBwbHVnaW4gZm9yIGV2ZXJ5IG5hbWVcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBuYW1lcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjb25maWdbbmFtZXNbaV1dID09PSB1bmRlZmluZWQgfHwgJC5pc0Z1bmN0aW9uKGNvbmZpZ1tuYW1lc1tpXV0pKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnW25hbWVzW2ldXSA9IGxvYWRlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkZCBmb3JjZWQgZWxlbWVudHMgbG9hZGVyXG4gICAgICAgIGZvciAodmFyIGMgPSAwLCBhID0gZWxlbWVudHMubGVuZ3RoOyBjIDwgYTsgYysrKSB7XG4gICAgICAgICAgICBmb3JjZWRbZWxlbWVudHNbY11dID0gbmFtZXNbMF07XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogY29udGFpbnMgYWxsIGxvZ2ljIGFuZCB0aGUgd2hvbGUgZWxlbWVudCBoYW5kbGluZ1xuICAgICAqIGlzIHBhY2tlZCBpbiBhIHByaXZhdGUgZnVuY3Rpb24gb3V0c2lkZSBjbGFzcyB0byByZWR1Y2UgbWVtb3J5IHVzYWdlLCBiZWNhdXNlIGl0IHdpbGwgbm90IGJlIGNyZWF0ZWQgb24gZXZlcnkgcGx1Z2luIGluc3RhbmNlXG4gICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAqIEBwYXJhbSB7TGF6eVBsdWdpbn0gaW5zdGFuY2VcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gY29uZmlnXG4gICAgICogQHBhcmFtIHtvYmplY3R8QXJyYXl9IGl0ZW1zXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGV2ZW50c1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lc3BhY2VcbiAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZXhlY3V0ZUxhenkoaW5zdGFuY2UsIGNvbmZpZywgaXRlbXMsIGV2ZW50cywgbmFtZXNwYWNlKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBhIGhlbHBlciB0byB0cmlnZ2VyIHRoZSAnb25GaW5pc2hlZEFsbCcgY2FsbGJhY2sgYWZ0ZXIgYWxsIG90aGVyIGV2ZW50c1xuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHZhciBfYXdhaXRpbmdBZnRlckxvYWQgPSAwLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB2aXNpYmxlIGNvbnRlbnQgd2lkdGhcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBfYWN0dWFsV2lkdGggPSAtMSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdmlzaWJsZSBjb250ZW50IGhlaWdodFxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIF9hY3R1YWxIZWlnaHQgPSAtMSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGV0ZXJtaW5lIHBvc3NpYmx5IGRldGVjdGVkIGhpZ2ggcGl4ZWwgZGVuc2l0eVxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBfaXNSZXRpbmFEaXNwbGF5ID0gZmFsc2UsIFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkaWN0aW9uYXJ5IGVudHJ5IGZvciBiZXR0ZXIgbWluaW1pemF0aW9uXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgX2FmdGVyTG9hZCA9ICdhZnRlckxvYWQnLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkaWN0aW9uYXJ5IGVudHJ5IGZvciBiZXR0ZXIgbWluaW1pemF0aW9uXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgX2xvYWQgPSAnbG9hZCcsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRpY3Rpb25hcnkgZW50cnkgZm9yIGJldHRlciBtaW5pbWl6YXRpb25cbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBfZXJyb3IgPSAnZXJyb3InLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkaWN0aW9uYXJ5IGVudHJ5IGZvciBiZXR0ZXIgbWluaW1pemF0aW9uXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgX2ltZyA9ICdpbWcnLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkaWN0aW9uYXJ5IGVudHJ5IGZvciBiZXR0ZXIgbWluaW1pemF0aW9uXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgX3NyYyA9ICdzcmMnLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkaWN0aW9uYXJ5IGVudHJ5IGZvciBiZXR0ZXIgbWluaW1pemF0aW9uXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgX3NyY3NldCA9ICdzcmNzZXQnLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkaWN0aW9uYXJ5IGVudHJ5IGZvciBiZXR0ZXIgbWluaW1pemF0aW9uXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgX3NpemVzID0gJ3NpemVzJyxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGljdGlvbmFyeSBlbnRyeSBmb3IgYmV0dGVyIG1pbmltaXphdGlvblxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9iYWNrZ3JvdW5kSW1hZ2UgPSAnYmFja2dyb3VuZC1pbWFnZSc7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGluaXRpYWxpemUgcGx1Z2luXG4gICAgICAgICAqIGJpbmQgbG9hZGluZyB0byBldmVudHMgb3Igc2V0IGRlbGF5IHRpbWUgdG8gbG9hZCBhbGwgaXRlbXMgYXQgb25jZVxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHJldHVybiB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfaW5pdGlhbGl6ZSgpIHtcbiAgICAgICAgICAgIC8vIGRldGVjdCBhY3R1YWwgZGV2aWNlIHBpeGVsIHJhdGlvXG4gICAgICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkVmFyaWFibGVcbiAgICAgICAgICAgIF9pc1JldGluYURpc3BsYXkgPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyA+IDE7XG5cbiAgICAgICAgICAgIC8vIHByZXBhcmUgYWxsIGluaXRpYWwgaXRlbXNcbiAgICAgICAgICAgIGl0ZW1zID0gX3ByZXBhcmVJdGVtcyhpdGVtcyk7XG5cbiAgICAgICAgICAgIC8vIGlmIGRlbGF5IHRpbWUgaXMgc2V0IGxvYWQgYWxsIGl0ZW1zIGF0IG9uY2UgYWZ0ZXIgZGVsYXkgdGltZVxuICAgICAgICAgICAgaWYgKGNvbmZpZy5kZWxheSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgX2xhenlMb2FkSXRlbXModHJ1ZSk7XG4gICAgICAgICAgICAgICAgfSwgY29uZmlnLmRlbGF5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgbm8gZGVsYXkgaXMgc2V0IG9yIGNvbWJpbmUgdXNhZ2UgaXMgYWN0aXZlIGJpbmQgZXZlbnRzXG4gICAgICAgICAgICBpZiAoY29uZmlnLmRlbGF5IDwgMCB8fCBjb25maWcuY29tYmluZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdW5pcXVlIGV2ZW50IGZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgZXZlbnRzLmUgPSBfdGhyb3R0bGUoY29uZmlnLnRocm90dGxlLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgICAgICAgICAvLyByZXNldCBkZXRlY3RlZCB3aW5kb3cgc2l6ZSBvbiByZXNpemUgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdyZXNpemUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfYWN0dWFsV2lkdGggPSBfYWN0dWFsSGVpZ2h0ID0gLTE7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBleGVjdXRlICdsYXp5IG1hZ2ljJ1xuICAgICAgICAgICAgICAgICAgICBfbGF6eUxvYWRJdGVtcyhldmVudC5hbGwpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIGZ1bmN0aW9uIHRvIGFkZCBuZXcgaXRlbXMgdG8gaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBldmVudHMuYSA9IGZ1bmN0aW9uKGFkZGl0aW9uYWxJdGVtcykge1xuICAgICAgICAgICAgICAgICAgICBhZGRpdGlvbmFsSXRlbXMgPSBfcHJlcGFyZUl0ZW1zKGFkZGl0aW9uYWxJdGVtcyk7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW1zLnB1c2guYXBwbHkoaXRlbXMsIGFkZGl0aW9uYWxJdGVtcyk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBmdW5jdGlvbiB0byBnZXQgYWxsIGluc3RhbmNlIGl0ZW1zIGxlZnRcbiAgICAgICAgICAgICAgICBldmVudHMuZyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBmaWx0ZXIgbG9hZGVkIGl0ZW1zIGJlZm9yZSByZXR1cm4gaW4gY2FzZSBpbnRlcm5hbCBmaWx0ZXIgd2FzIG5vdCBydW5uaW5nIHVudGlsIG5vd1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKGl0ZW1zID0gJChpdGVtcykuZmlsdGVyKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICEkKHRoaXMpLmRhdGEoY29uZmlnLmxvYWRlZE5hbWUpO1xuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBmdW5jdGlvbiB0byBmb3JjZSBsb2FkaW5nIGVsZW1lbnRzXG4gICAgICAgICAgICAgICAgZXZlbnRzLmYgPSBmdW5jdGlvbihmb3JjZWRJdGVtcykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZvcmNlZEl0ZW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBvbmx5IGhhbmRsZSBpdGVtIGlmIGF2YWlsYWJsZSBpbiBjdXJyZW50IGluc3RhbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB1c2UgYSBjb21wYXJlIGZ1bmN0aW9uLCBiZWNhdXNlIFplcHRvIGNhbid0IGhhbmRsZSBvYmplY3QgcGFyYW1ldGVyIGZvciBmaWx0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZhciBpdGVtID0gaXRlbXMuZmlsdGVyKGZvcmNlZEl0ZW1zW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIGpzaGludCBsb29wZnVuYzogdHJ1ZSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGl0ZW0gPSBpdGVtcy5maWx0ZXIoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMgPT09IGZvcmNlZEl0ZW1zW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpdGVtLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9sYXp5TG9hZEl0ZW1zKGZhbHNlLCBpdGVtKTsgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBsb2FkIGluaXRpYWwgaXRlbXNcbiAgICAgICAgICAgICAgICBfbGF6eUxvYWRJdGVtcygpO1xuXG4gICAgICAgICAgICAgICAgLy8gYmluZCBsYXp5IGxvYWQgZnVuY3Rpb25zIHRvIHNjcm9sbCBhbmQgcmVzaXplIGV2ZW50XG4gICAgICAgICAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5yZXNvbHZlZFZhcmlhYmxlXG4gICAgICAgICAgICAgICAgJChjb25maWcuYXBwZW5kU2Nyb2xsKS5vbignc2Nyb2xsLicgKyBuYW1lc3BhY2UgKyAnIHJlc2l6ZS4nICsgbmFtZXNwYWNlLCBldmVudHMuZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogcHJlcGFyZSBpdGVtcyBiZWZvcmUgaGFuZGxlIHRoZW1cbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl8b2JqZWN0fGpRdWVyeX0gaXRlbXNcbiAgICAgICAgICogQHJldHVybiB7QXJyYXl8b2JqZWN0fGpRdWVyeX1cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9wcmVwYXJlSXRlbXMoaXRlbXMpIHtcbiAgICAgICAgICAgIC8vIGZldGNoIHVzZWQgY29uZmlndXJhdGlvbnMgYmVmb3JlIGxvb3BzXG4gICAgICAgICAgICB2YXIgZGVmYXVsdEltYWdlID0gY29uZmlnLmRlZmF1bHRJbWFnZSxcbiAgICAgICAgICAgICAgICBwbGFjZWhvbGRlciA9IGNvbmZpZy5wbGFjZWhvbGRlcixcbiAgICAgICAgICAgICAgICBpbWFnZUJhc2UgPSBjb25maWcuaW1hZ2VCYXNlLFxuICAgICAgICAgICAgICAgIHNyY3NldEF0dHJpYnV0ZSA9IGNvbmZpZy5zcmNzZXRBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgbG9hZGVyQXR0cmlidXRlID0gY29uZmlnLmxvYWRlckF0dHJpYnV0ZSxcbiAgICAgICAgICAgICAgICBmb3JjZWRUYWdzID0gY29uZmlnLl9mIHx8IHt9O1xuXG4gICAgICAgICAgICAvLyBmaWx0ZXIgaXRlbXMgYW5kIG9ubHkgYWRkIHRob3NlIHdobyBub3QgaGFuZGxlZCB5ZXQgYW5kIGdvdCBuZWVkZWQgYXR0cmlidXRlcyBhdmFpbGFibGVcbiAgICAgICAgICAgIGl0ZW1zID0gJChpdGVtcykuZmlsdGVyKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciBlbGVtZW50ID0gJCh0aGlzKSxcbiAgICAgICAgICAgICAgICAgICAgdGFnID0gX2dldEVsZW1lbnRUYWdOYW1lKHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuICFlbGVtZW50LmRhdGEoY29uZmlnLmhhbmRsZWROYW1lKSAmJiBcbiAgICAgICAgICAgICAgICAgICAgICAgKGVsZW1lbnQuYXR0cihjb25maWcuYXR0cmlidXRlKSB8fCBlbGVtZW50LmF0dHIoc3Jjc2V0QXR0cmlidXRlKSB8fCBlbGVtZW50LmF0dHIobG9hZGVyQXR0cmlidXRlKSB8fCBmb3JjZWRUYWdzW3RhZ10gIT09IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAvLyBhcHBlbmQgcGx1Z2luIGluc3RhbmNlIHRvIGFsbCBlbGVtZW50c1xuICAgICAgICAgICAgLmRhdGEoJ3BsdWdpbl8nICsgY29uZmlnLm5hbWUsIGluc3RhbmNlKTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBpdGVtcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZWxlbWVudCA9ICQoaXRlbXNbaV0pLFxuICAgICAgICAgICAgICAgICAgICB0YWcgPSBfZ2V0RWxlbWVudFRhZ05hbWUoaXRlbXNbaV0pLFxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50SW1hZ2VCYXNlID0gZWxlbWVudC5hdHRyKGNvbmZpZy5pbWFnZUJhc2VBdHRyaWJ1dGUpIHx8IGltYWdlQmFzZTtcblxuICAgICAgICAgICAgICAgIC8vIGdlbmVyYXRlIGFuZCB1cGRhdGUgc291cmNlIHNldCBpZiBhbiBpbWFnZSBiYXNlIGlzIHNldFxuICAgICAgICAgICAgICAgIGlmICh0YWcgPT09IF9pbWcgJiYgZWxlbWVudEltYWdlQmFzZSAmJiBlbGVtZW50LmF0dHIoc3Jjc2V0QXR0cmlidXRlKSkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmF0dHIoc3Jjc2V0QXR0cmlidXRlLCBfZ2V0Q29ycmVjdGVkU3JjU2V0KGVsZW1lbnQuYXR0cihzcmNzZXRBdHRyaWJ1dGUpLCBlbGVtZW50SW1hZ2VCYXNlKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYWRkIGxvYWRlciB0byBmb3JjZWQgZWxlbWVudCB0eXBlc1xuICAgICAgICAgICAgICAgIGlmIChmb3JjZWRUYWdzW3RhZ10gIT09IHVuZGVmaW5lZCAmJiAhZWxlbWVudC5hdHRyKGxvYWRlckF0dHJpYnV0ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5hdHRyKGxvYWRlckF0dHJpYnV0ZSwgZm9yY2VkVGFnc1t0YWddKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgZGVmYXVsdCBpbWFnZSBvbiBldmVyeSBlbGVtZW50IHdpdGhvdXQgc291cmNlXG4gICAgICAgICAgICAgICAgaWYgKHRhZyA9PT0gX2ltZyAmJiBkZWZhdWx0SW1hZ2UgJiYgIWVsZW1lbnQuYXR0cihfc3JjKSkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmF0dHIoX3NyYywgZGVmYXVsdEltYWdlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgcGxhY2Vob2xkZXIgb24gZXZlcnkgZWxlbWVudCB3aXRob3V0IGJhY2tncm91bmQgaW1hZ2VcbiAgICAgICAgICAgICAgICBlbHNlIGlmICh0YWcgIT09IF9pbWcgJiYgcGxhY2Vob2xkZXIgJiYgKCFlbGVtZW50LmNzcyhfYmFja2dyb3VuZEltYWdlKSB8fCBlbGVtZW50LmNzcyhfYmFja2dyb3VuZEltYWdlKSA9PT0gJ25vbmUnKSkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmNzcyhfYmFja2dyb3VuZEltYWdlLCBcInVybCgnXCIgKyBwbGFjZWhvbGRlciArIFwiJylcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gaXRlbXM7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogdGhlICdsYXp5IG1hZ2ljJyAtIGNoZWNrIGFsbCBpdGVtc1xuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHBhcmFtIHtib29sZWFufSBbYWxsSXRlbXNdXG4gICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbZm9yY2VkXVxuICAgICAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9sYXp5TG9hZEl0ZW1zKGFsbEl0ZW1zLCBmb3JjZWQpIHtcbiAgICAgICAgICAgIC8vIHNraXAgaWYgbm8gaXRlbXMgd2hlcmUgbGVmdFxuICAgICAgICAgICAgaWYgKCFpdGVtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAvLyBkZXN0cm95IGluc3RhbmNlIGlmIG9wdGlvbiBpcyBlbmFibGVkXG4gICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5hdXRvRGVzdHJveSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkRnVuY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGVsZW1lbnRzID0gZm9yY2VkIHx8IGl0ZW1zLFxuICAgICAgICAgICAgICAgIGxvYWRUcmlnZ2VyZWQgPSBmYWxzZSxcbiAgICAgICAgICAgICAgICBpbWFnZUJhc2UgPSBjb25maWcuaW1hZ2VCYXNlIHx8ICcnLFxuICAgICAgICAgICAgICAgIHNyY3NldEF0dHJpYnV0ZSA9IGNvbmZpZy5zcmNzZXRBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgaGFuZGxlZE5hbWUgPSBjb25maWcuaGFuZGxlZE5hbWU7XG5cbiAgICAgICAgICAgIC8vIGxvb3AgYWxsIGF2YWlsYWJsZSBpdGVtc1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBlbGVtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIC8vIGl0ZW0gaXMgYXQgbGVhc3QgaW4gbG9hZGFibGUgYXJlYVxuICAgICAgICAgICAgICAgIGlmIChhbGxJdGVtcyB8fCBmb3JjZWQgfHwgX2lzSW5Mb2FkYWJsZUFyZWEoZWxlbWVudHNbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlbGVtZW50ID0gJChlbGVtZW50c1tpXSksXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWcgPSBfZ2V0RWxlbWVudFRhZ05hbWUoZWxlbWVudHNbaV0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlID0gZWxlbWVudC5hdHRyKGNvbmZpZy5hdHRyaWJ1dGUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudEltYWdlQmFzZSA9IGVsZW1lbnQuYXR0cihjb25maWcuaW1hZ2VCYXNlQXR0cmlidXRlKSB8fCBpbWFnZUJhc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXN0b21Mb2FkZXIgPSBlbGVtZW50LmF0dHIoY29uZmlnLmxvYWRlckF0dHJpYnV0ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlzIG5vdCBhbHJlYWR5IGhhbmRsZWQgXG4gICAgICAgICAgICAgICAgICAgIGlmICghZWxlbWVudC5kYXRhKGhhbmRsZWROYW1lKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGlzIHZpc2libGUgb3IgdmlzaWJpbGl0eSBkb2Vzbid0IG1hdHRlclxuICAgICAgICAgICAgICAgICAgICAgICAgKCFjb25maWcudmlzaWJsZU9ubHkgfHwgZWxlbWVudC5pcygnOnZpc2libGUnKSkgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYW5kIGltYWdlIHNvdXJjZSBvciBzb3VyY2Ugc2V0IGF0dHJpYnV0ZSBpcyBhdmFpbGFibGVcbiAgICAgICAgICAgICAgICAgICAgICAgIChhdHRyaWJ1dGUgfHwgZWxlbWVudC5hdHRyKHNyY3NldEF0dHJpYnV0ZSkpICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhbmQgaXMgaW1hZ2UgdGFnIHdoZXJlIGF0dHJpYnV0ZSBpcyBub3QgZXF1YWwgc291cmNlIG9yIHNvdXJjZSBzZXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAodGFnID09PSBfaW1nICYmIChlbGVtZW50SW1hZ2VCYXNlICsgYXR0cmlidXRlICE9PSBlbGVtZW50LmF0dHIoX3NyYykgfHwgZWxlbWVudC5hdHRyKHNyY3NldEF0dHJpYnV0ZSkgIT09IGVsZW1lbnQuYXR0cihfc3Jjc2V0KSkpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb3IgaXMgbm9uIGltYWdlIHRhZyB3aGVyZSBhdHRyaWJ1dGUgaXMgbm90IGVxdWFsIGJhY2tncm91bmRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAodGFnICE9PSBfaW1nICYmIGVsZW1lbnRJbWFnZUJhc2UgKyBhdHRyaWJ1dGUgIT09IGVsZW1lbnQuY3NzKF9iYWNrZ3JvdW5kSW1hZ2UpKVxuICAgICAgICAgICAgICAgICAgICAgICAgKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb3IgY3VzdG9tIGxvYWRlciBpcyBhdmFpbGFibGVcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1c3RvbUxvYWRlcikpXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1hcmsgZWxlbWVudCBhbHdheXMgYXMgaGFuZGxlZCBhcyB0aGlzIHBvaW50IHRvIHByZXZlbnQgZG91YmxlIGhhbmRsaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkVHJpZ2dlcmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuZGF0YShoYW5kbGVkTmFtZSwgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGxvYWQgaXRlbVxuICAgICAgICAgICAgICAgICAgICAgICAgX2hhbmRsZUl0ZW0oZWxlbWVudCwgdGFnLCBlbGVtZW50SW1hZ2VCYXNlLCBjdXN0b21Mb2FkZXIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB3aGVuIHNvbWV0aGluZyB3YXMgbG9hZGVkIHJlbW92ZSB0aGVtIGZyb20gcmVtYWluaW5nIGl0ZW1zXG4gICAgICAgICAgICBpZiAobG9hZFRyaWdnZXJlZCkge1xuICAgICAgICAgICAgICAgIGl0ZW1zID0gJChpdGVtcykuZmlsdGVyKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gISQodGhpcykuZGF0YShoYW5kbGVkTmFtZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogbG9hZCB0aGUgZ2l2ZW4gZWxlbWVudCB0aGUgbGF6eSB3YXlcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBlbGVtZW50XG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0YWdcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGltYWdlQmFzZVxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBbY3VzdG9tTG9hZGVyXVxuICAgICAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9oYW5kbGVJdGVtKGVsZW1lbnQsIHRhZywgaW1hZ2VCYXNlLCBjdXN0b21Mb2FkZXIpIHtcbiAgICAgICAgICAgIC8vIGluY3JlbWVudCBjb3VudCBvZiBpdGVtcyB3YWl0aW5nIGZvciBhZnRlciBsb2FkXG4gICAgICAgICAgICArK19hd2FpdGluZ0FmdGVyTG9hZDtcblxuICAgICAgICAgICAgLy8gZXh0ZW5kZWQgZXJyb3IgY2FsbGJhY2sgZm9yIGNvcnJlY3QgJ29uRmluaXNoZWRBbGwnIGhhbmRsaW5nXG4gICAgICAgICAgICB2YXIgZXJyb3JDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIF90cmlnZ2VyQ2FsbGJhY2soJ29uRXJyb3InLCBlbGVtZW50KTtcbiAgICAgICAgICAgICAgICBfcmVkdWNlQXdhaXRpbmcoKTtcblxuICAgICAgICAgICAgICAgIC8vIHByZXZlbnQgZnVydGhlciBjYWxsYmFjayBjYWxsc1xuICAgICAgICAgICAgICAgIGVycm9yQ2FsbGJhY2sgPSAkLm5vb3A7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyB0cmlnZ2VyIGZ1bmN0aW9uIGJlZm9yZSBsb2FkaW5nIGltYWdlXG4gICAgICAgICAgICBfdHJpZ2dlckNhbGxiYWNrKCdiZWZvcmVMb2FkJywgZWxlbWVudCk7XG5cbiAgICAgICAgICAgIC8vIGZldGNoIGFsbCBkb3VibGUgdXNlZCBkYXRhIGhlcmUgZm9yIGJldHRlciBjb2RlIG1pbmltaXphdGlvblxuICAgICAgICAgICAgdmFyIHNyY0F0dHJpYnV0ZSA9IGNvbmZpZy5hdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgc3Jjc2V0QXR0cmlidXRlID0gY29uZmlnLnNyY3NldEF0dHJpYnV0ZSxcbiAgICAgICAgICAgICAgICBzaXplc0F0dHJpYnV0ZSA9IGNvbmZpZy5zaXplc0F0dHJpYnV0ZSxcbiAgICAgICAgICAgICAgICByZXRpbmFBdHRyaWJ1dGUgPSBjb25maWcucmV0aW5hQXR0cmlidXRlLFxuICAgICAgICAgICAgICAgIHJlbW92ZUF0dHJpYnV0ZSA9IGNvbmZpZy5yZW1vdmVBdHRyaWJ1dGUsXG4gICAgICAgICAgICAgICAgbG9hZGVkTmFtZSA9IGNvbmZpZy5sb2FkZWROYW1lLFxuICAgICAgICAgICAgICAgIGVsZW1lbnRSZXRpbmEgPSBlbGVtZW50LmF0dHIocmV0aW5hQXR0cmlidXRlKTtcblxuICAgICAgICAgICAgLy8gaGFuZGxlIGN1c3RvbSBsb2FkZXJcbiAgICAgICAgICAgIGlmIChjdXN0b21Mb2FkZXIpIHtcbiAgICAgICAgICAgICAgICAvLyBvbiBsb2FkIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgdmFyIGxvYWRDYWxsYmFjayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgYXR0cmlidXRlIGZyb20gZWxlbWVudFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVtb3ZlQXR0cmlidXRlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHIoY29uZmlnLmxvYWRlckF0dHJpYnV0ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBtYXJrIGVsZW1lbnQgYXMgbG9hZGVkXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuZGF0YShsb2FkZWROYW1lLCB0cnVlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjYWxsIGFmdGVyIGxvYWQgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgX3RyaWdnZXJDYWxsYmFjayhfYWZ0ZXJMb2FkLCBlbGVtZW50KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgaXRlbSBmcm9tIHdhaXRpbmcgcXVldWUgYW5kIHBvc3NpYmx5IHRyaWdnZXIgZmluaXNoZWQgZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgLy8gaXQncyBuZWVkZWQgdG8gYmUgYXN5bmNocm9ub3VzIHRvIHJ1biBhZnRlciBmaWx0ZXIgd2FzIGluIF9sYXp5TG9hZEl0ZW1zXG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoX3JlZHVjZUF3YWl0aW5nLCAxKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBwcmV2ZW50IGZ1cnRoZXIgY2FsbGJhY2sgY2FsbHNcbiAgICAgICAgICAgICAgICAgICAgbG9hZENhbGxiYWNrID0gJC5ub29wO1xuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAvLyBiaW5kIGVycm9yIGV2ZW50IHRvIHRyaWdnZXIgY2FsbGJhY2sgYW5kIHJlZHVjZSB3YWl0aW5nIGFtb3VudFxuICAgICAgICAgICAgICAgIGVsZW1lbnQub2ZmKF9lcnJvcikub25lKF9lcnJvciwgZXJyb3JDYWxsYmFjaylcblxuICAgICAgICAgICAgICAgIC8vIGJpbmQgYWZ0ZXIgbG9hZCBjYWxsYmFjayB0byBlbGVtZW50XG4gICAgICAgICAgICAgICAgLm9uZShfbG9hZCwgbG9hZENhbGxiYWNrKTtcblxuICAgICAgICAgICAgICAgIC8vIHRyaWdnZXIgY3VzdG9tIGxvYWRlciBhbmQgaGFuZGxlIHJlc3BvbnNlXG4gICAgICAgICAgICAgICAgaWYgKCFfdHJpZ2dlckNhbGxiYWNrKGN1c3RvbUxvYWRlciwgZWxlbWVudCwgZnVuY3Rpb24ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQub2ZmKF9sb2FkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvYWRDYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5vZmYoX2Vycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yQ2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQudHJpZ2dlcihfZXJyb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaGFuZGxlIGltYWdlc1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIGltYWdlIG9iamVjdFxuICAgICAgICAgICAgICAgIHZhciBpbWFnZU9iaiA9ICQobmV3IEltYWdlKCkpO1xuXG4gICAgICAgICAgICAgICAgLy8gYmluZCBlcnJvciBldmVudCB0byB0cmlnZ2VyIGNhbGxiYWNrIGFuZCByZWR1Y2Ugd2FpdGluZyBhbW91bnRcbiAgICAgICAgICAgICAgICBpbWFnZU9iai5vbmUoX2Vycm9yLCBlcnJvckNhbGxiYWNrKVxuXG4gICAgICAgICAgICAgICAgLy8gYmluZCBhZnRlciBsb2FkIGNhbGxiYWNrIHRvIGltYWdlXG4gICAgICAgICAgICAgICAgLm9uZShfbG9hZCwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBlbGVtZW50IGZyb20gdmlld1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmhpZGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBzZXQgaW1hZ2UgYmFjayB0byBlbGVtZW50XG4gICAgICAgICAgICAgICAgICAgIC8vIGRvIGl0IGFzIHNpbmdsZSAnYXR0cicgY2FsbHMsIHRvIGJlIHN1cmUgJ3NyYycgaXMgc2V0IGFmdGVyICdzcmNzZXQnXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YWcgPT09IF9pbWcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuYXR0cihfc2l6ZXMsIGltYWdlT2JqLmF0dHIoX3NpemVzKSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cihfc3Jjc2V0LCBpbWFnZU9iai5hdHRyKF9zcmNzZXQpKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKF9zcmMsIGltYWdlT2JqLmF0dHIoX3NyYykpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5jc3MoX2JhY2tncm91bmRJbWFnZSwgXCJ1cmwoJ1wiICsgaW1hZ2VPYmouYXR0cihfc3JjKSArIFwiJylcIik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBicmluZyBpdCBiYWNrIHdpdGggc29tZSBlZmZlY3QhXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRbY29uZmlnLmVmZmVjdF0oY29uZmlnLmVmZmVjdFRpbWUpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBhdHRyaWJ1dGUgZnJvbSBlbGVtZW50XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZW1vdmVBdHRyaWJ1dGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cihzcmNBdHRyaWJ1dGUgKyAnICcgKyBzcmNzZXRBdHRyaWJ1dGUgKyAnICcgKyByZXRpbmFBdHRyaWJ1dGUgKyAnICcgKyBjb25maWcuaW1hZ2VCYXNlQXR0cmlidXRlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb25seSByZW1vdmUgJ3NpemVzJyBhdHRyaWJ1dGUsIGlmIGl0IHdhcyBhIGN1c3RvbSBvbmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzaXplc0F0dHJpYnV0ZSAhPT0gX3NpemVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyKHNpemVzQXR0cmlidXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hcmsgZWxlbWVudCBhcyBsb2FkZWRcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5kYXRhKGxvYWRlZE5hbWUsIHRydWUpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbGwgYWZ0ZXIgbG9hZCBldmVudFxuICAgICAgICAgICAgICAgICAgICBfdHJpZ2dlckNhbGxiYWNrKF9hZnRlckxvYWQsIGVsZW1lbnQpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNsZWFudXAgaW1hZ2Ugb2JqZWN0XG4gICAgICAgICAgICAgICAgICAgIGltYWdlT2JqLnJlbW92ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBpdGVtIGZyb20gd2FpdGluZyBxdWV1ZSBhbmQgcG9zc2libHkgdHJpZ2dlciBmaW5pc2hlZCBldmVudFxuICAgICAgICAgICAgICAgICAgICBfcmVkdWNlQXdhaXRpbmcoKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIHNldCBzb3VyY2VzXG4gICAgICAgICAgICAgICAgLy8gZG8gaXQgYXMgc2luZ2xlICdhdHRyJyBjYWxscywgdG8gYmUgc3VyZSAnc3JjJyBpcyBzZXQgYWZ0ZXIgJ3NyY3NldCdcbiAgICAgICAgICAgICAgICB2YXIgaW1hZ2VTcmMgPSAoX2lzUmV0aW5hRGlzcGxheSAmJiBlbGVtZW50UmV0aW5hID8gZWxlbWVudFJldGluYSA6IGVsZW1lbnQuYXR0cihzcmNBdHRyaWJ1dGUpKSB8fCAnJztcbiAgICAgICAgICAgICAgICBpbWFnZU9iai5hdHRyKF9zaXplcywgZWxlbWVudC5hdHRyKHNpemVzQXR0cmlidXRlKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKF9zcmNzZXQsIGVsZW1lbnQuYXR0cihzcmNzZXRBdHRyaWJ1dGUpKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoX3NyYywgaW1hZ2VTcmMgPyBpbWFnZUJhc2UgKyBpbWFnZVNyYyA6IG51bGwpO1xuXG4gICAgICAgICAgICAgICAgLy8gY2FsbCBhZnRlciBsb2FkIGV2ZW4gb24gY2FjaGVkIGltYWdlXG4gICAgICAgICAgICAgICAgaW1hZ2VPYmouY29tcGxldGUgJiYgaW1hZ2VPYmoudHJpZ2dlcihfbG9hZCk7IC8vIGpzaGludCBpZ25vcmUgOiBsaW5lXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogY2hlY2sgaWYgdGhlIGdpdmVuIGVsZW1lbnQgaXMgaW5zaWRlIHRoZSBjdXJyZW50IHZpZXdwb3J0IG9yIHRocmVzaG9sZFxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHBhcmFtIHtvYmplY3R9IGVsZW1lbnRcbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9pc0luTG9hZGFibGVBcmVhKGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBlbGVtZW50Qm91bmQgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLFxuICAgICAgICAgICAgICAgIGRpcmVjdGlvbiAgICA9IGNvbmZpZy5zY3JvbGxEaXJlY3Rpb24sXG4gICAgICAgICAgICAgICAgdGhyZXNob2xkICAgID0gY29uZmlnLnRocmVzaG9sZCxcbiAgICAgICAgICAgICAgICB2ZXJ0aWNhbCAgICAgPSAvLyBjaGVjayBpZiBlbGVtZW50IGlzIGluIGxvYWRhYmxlIGFyZWEgZnJvbSB0b3BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoKF9nZXRBY3R1YWxIZWlnaHQoKSArIHRocmVzaG9sZCkgPiBlbGVtZW50Qm91bmQudG9wKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIGVsZW1lbnQgaXMgZXZlbiBpbiBsb2FkYWJsZSBhcmUgZnJvbSBib3R0b21cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoLXRocmVzaG9sZCA8IGVsZW1lbnRCb3VuZC5ib3R0b20pLFxuICAgICAgICAgICAgICAgIGhvcml6b250YWwgICA9IC8vIGNoZWNrIGlmIGVsZW1lbnQgaXMgaW4gbG9hZGFibGUgYXJlYSBmcm9tIGxlZnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoKF9nZXRBY3R1YWxXaWR0aCgpICsgdGhyZXNob2xkKSA+IGVsZW1lbnRCb3VuZC5sZWZ0KSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIGVsZW1lbnQgaXMgZXZlbiBpbiBsb2FkYWJsZSBhcmVhIGZyb20gcmlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoLXRocmVzaG9sZCA8IGVsZW1lbnRCb3VuZC5yaWdodCk7XG5cbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb24gPT09ICd2ZXJ0aWNhbCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmVydGljYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChkaXJlY3Rpb24gPT09ICdob3Jpem9udGFsJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBob3Jpem9udGFsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdmVydGljYWwgJiYgaG9yaXpvbnRhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZWNlaXZlIHRoZSBjdXJyZW50IHZpZXdlZCB3aWR0aCBvZiB0aGUgYnJvd3NlclxuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHJldHVybiB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2dldEFjdHVhbFdpZHRoKCkge1xuICAgICAgICAgICAgcmV0dXJuIF9hY3R1YWxXaWR0aCA+PSAwID8gX2FjdHVhbFdpZHRoIDogKF9hY3R1YWxXaWR0aCA9ICQod2luZG93KS53aWR0aCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZWNlaXZlIHRoZSBjdXJyZW50IHZpZXdlZCBoZWlnaHQgb2YgdGhlIGJyb3dzZXJcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9nZXRBY3R1YWxIZWlnaHQoKSB7XG4gICAgICAgICAgICByZXR1cm4gX2FjdHVhbEhlaWdodCA+PSAwID8gX2FjdHVhbEhlaWdodCA6IChfYWN0dWFsSGVpZ2h0ID0gJCh3aW5kb3cpLmhlaWdodCgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBnZXQgbG93ZXJjYXNlIHRhZyBuYW1lIG9mIGFuIGVsZW1lbnRcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEBwYXJhbSB7b2JqZWN0fSBlbGVtZW50XG4gICAgICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfZ2V0RWxlbWVudFRhZ05hbWUoZWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHByZXBlbmQgaW1hZ2UgYmFzZSB0byBhbGwgc3Jjc2V0IGVudHJpZXNcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzcmNzZXRcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGltYWdlQmFzZVxuICAgICAgICAgKiBAcmV0dXJucyB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2dldENvcnJlY3RlZFNyY1NldChzcmNzZXQsIGltYWdlQmFzZSkge1xuICAgICAgICAgICAgaWYgKGltYWdlQmFzZSkge1xuICAgICAgICAgICAgICAgIC8vIHRyaW0sIHJlbW92ZSB1bm5lY2Vzc2FyeSBzcGFjZXMgYW5kIHNwbGl0IGVudHJpZXNcbiAgICAgICAgICAgICAgICB2YXIgZW50cmllcyA9IHNyY3NldC5zcGxpdCgnLCcpO1xuICAgICAgICAgICAgICAgIHNyY3NldCA9ICcnO1xuXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBlbnRyaWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBzcmNzZXQgKz0gaW1hZ2VCYXNlICsgZW50cmllc1tpXS50cmltKCkgKyAoaSAhPT0gbCAtIDEgPyAnLCcgOiAnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3Jjc2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGhlbHBlciBmdW5jdGlvbiB0byB0aHJvdHRsZSBkb3duIGV2ZW50IHRyaWdnZXJpbmdcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkZWxheVxuICAgICAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAgICAgKiBAcmV0dXJuIHtmdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF90aHJvdHRsZShkZWxheSwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHZhciB0aW1lb3V0LFxuICAgICAgICAgICAgICAgIGxhc3RFeGVjdXRlID0gMDtcblxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50LCBpZ25vcmVUaHJvdHRsZSkge1xuICAgICAgICAgICAgICAgIHZhciBlbGFwc2VkID0gK25ldyBEYXRlKCkgLSBsYXN0RXhlY3V0ZTtcblxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHJ1bigpIHtcbiAgICAgICAgICAgICAgICAgICAgbGFzdEV4ZWN1dGUgPSArbmV3IERhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5yZXNvbHZlZEZ1bmN0aW9uXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoaW5zdGFuY2UsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aW1lb3V0ICYmIGNsZWFyVGltZW91dCh0aW1lb3V0KTsgLy8ganNoaW50IGlnbm9yZSA6IGxpbmVcblxuICAgICAgICAgICAgICAgIGlmIChlbGFwc2VkID4gZGVsYXkgfHwgIWNvbmZpZy5lbmFibGVUaHJvdHRsZSB8fCBpZ25vcmVUaHJvdHRsZSkge1xuICAgICAgICAgICAgICAgICAgICBydW4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KHJ1biwgZGVsYXkgLSBlbGFwc2VkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJlZHVjZSBjb3VudCBvZiBhd2FpdGluZyBlbGVtZW50cyB0byAnYWZ0ZXJMb2FkJyBldmVudCBhbmQgZmlyZSAnb25GaW5pc2hlZEFsbCcgaWYgcmVhY2hlZCB6ZXJvXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9yZWR1Y2VBd2FpdGluZygpIHtcbiAgICAgICAgICAgIC0tX2F3YWl0aW5nQWZ0ZXJMb2FkO1xuXG4gICAgICAgICAgICAvLyBpZiBubyBpdGVtcyB3ZXJlIGxlZnQgdHJpZ2dlciBmaW5pc2hlZCBldmVudFxuICAgICAgICAgICAgaWYgKCFpdGVtcy5sZW5ndGggJiYgIV9hd2FpdGluZ0FmdGVyTG9hZCkge1xuICAgICAgICAgICAgICAgIF90cmlnZ2VyQ2FsbGJhY2soJ29uRmluaXNoZWRBbGwnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBzaW5nbGUgaW1wbGVtZW50YXRpb24gdG8gaGFuZGxlIGNhbGxiYWNrcywgcGFzcyBlbGVtZW50IGFuZCBzZXQgJ3RoaXMnIHRvIGN1cnJlbnQgaW5zdGFuY2VcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfGZ1bmN0aW9ufSBjYWxsYmFja1xuICAgICAgICAgKiBAcGFyYW0ge29iamVjdH0gW2VsZW1lbnRdXG4gICAgICAgICAqIEBwYXJhbSB7Kn0gW2FyZ3NdXG4gICAgICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfdHJpZ2dlckNhbGxiYWNrKGNhbGxiYWNrLCBlbGVtZW50LCBhcmdzKSB7XG4gICAgICAgICAgICBpZiAoKGNhbGxiYWNrID0gY29uZmlnW2NhbGxiYWNrXSkpIHtcbiAgICAgICAgICAgICAgICAvLyBqUXVlcnkncyBpbnRlcm5hbCAnJChhcmd1bWVudHMpLnNsaWNlKDEpJyBhcmUgY2F1c2luZyBwcm9ibGVtcyBhdCBsZWFzdCBvbiBvbGQgaVBhZHNcbiAgICAgICAgICAgICAgICAvLyBiZWxvdyBpcyBzaG9ydGhhbmQgb2YgJ0FycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSknXG4gICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkoaW5zdGFuY2UsIFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIGV2ZW50IGRyaXZlbiBvciB3aW5kb3cgaXMgYWxyZWFkeSBsb2FkZWQgZG9uJ3Qgd2FpdCBmb3IgcGFnZSBsb2FkaW5nXG4gICAgICAgIGlmIChjb25maWcuYmluZCA9PT0gJ2V2ZW50JyB8fCB3aW5kb3dMb2FkZWQpIHtcbiAgICAgICAgICAgIF9pbml0aWFsaXplKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBvdGhlcndpc2UgbG9hZCBpbml0aWFsIGl0ZW1zIGFuZCBzdGFydCBsYXp5IGFmdGVyIHBhZ2UgbG9hZFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgICAgICAgICAgJCh3aW5kb3cpLm9uKF9sb2FkICsgJy4nICsgbmFtZXNwYWNlLCBfaW5pdGlhbGl6ZSk7XG4gICAgICAgIH0gIFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGxhenkgcGx1Z2luIGNsYXNzIGNvbnN0cnVjdG9yXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGVsZW1lbnRzXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzXG4gICAgICogQHJldHVybiB7b2JqZWN0fExhenlQbHVnaW59XG4gICAgICovXG4gICAgZnVuY3Rpb24gTGF6eVBsdWdpbihlbGVtZW50cywgc2V0dGluZ3MpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRoaXMgbGF6eSBwbHVnaW4gaW5zdGFuY2VcbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEB0eXBlIHtvYmplY3R8TGF6eVBsdWdpbnxMYXp5UGx1Z2luLnByb3RvdHlwZX1cbiAgICAgICAgICovXG4gICAgICAgIHZhciBfaW5zdGFuY2UgPSB0aGlzLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB0aGlzIGxhenkgcGx1Z2luIGluc3RhbmNlIGNvbmZpZ3VyYXRpb25cbiAgICAgICAgICogQGFjY2VzcyBwcml2YXRlXG4gICAgICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBfY29uZmlnID0gJC5leHRlbmQoe30sIF9pbnN0YW5jZS5jb25maWcsIHNldHRpbmdzKSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogaW5zdGFuY2UgZ2VuZXJhdGVkIGV2ZW50IGV4ZWN1dGVkIG9uIGNvbnRhaW5lciBzY3JvbGwgb3IgcmVzaXplXG4gICAgICAgICAqIHBhY2tlZCBpbiBhbiBvYmplY3QgdG8gYmUgcmVmZXJlbmNlYWJsZSBhbmQgc2hvcnQgbmFtZWQgYmVjYXVzZSBwcm9wZXJ0aWVzIHdpbGwgbm90IGJlIG1pbmlmaWVkXG4gICAgICAgICAqIEBhY2Nlc3MgcHJpdmF0ZVxuICAgICAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX2V2ZW50cyA9IHt9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB1bmlxdWUgbmFtZXNwYWNlIGZvciBpbnN0YW5jZSByZWxhdGVkIGV2ZW50c1xuICAgICAgICAgKiBAYWNjZXNzIHByaXZhdGVcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9uYW1lc3BhY2UgPSBfY29uZmlnLm5hbWUgKyAnLScgKyAoKytsYXp5SW5zdGFuY2VJZCk7XG5cbiAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5kZWZpbmVkUHJvcGVydHlBc3NpZ25tZW50XG4gICAgICAgIC8qKlxuICAgICAgICAgKiB3cmFwcGVyIHRvIGdldCBvciBzZXQgYW4gZW50cnkgZnJvbSBwbHVnaW4gaW5zdGFuY2UgY29uZmlndXJhdGlvblxuICAgICAgICAgKiBtdWNoIHNtYWxsZXIgb24gbWluaWZ5IGFzIGRpcmVjdCBhY2Nlc3NcbiAgICAgICAgICogQGFjY2VzcyBwdWJsaWNcbiAgICAgICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gZW50cnlOYW1lXG4gICAgICAgICAqIEBwYXJhbSB7Kn0gW3ZhbHVlXVxuICAgICAgICAgKiBAcmV0dXJuIHtMYXp5UGx1Z2lufCp9XG4gICAgICAgICAqL1xuICAgICAgICBfaW5zdGFuY2UuY29uZmlnID0gZnVuY3Rpb24oZW50cnlOYW1lLCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gX2NvbmZpZ1tlbnRyeU5hbWVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfY29uZmlnW2VudHJ5TmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiBfaW5zdGFuY2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5kZWZpbmVkUHJvcGVydHlBc3NpZ25tZW50XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBhZGQgYWRkaXRpb25hbCBpdGVtcyB0byBjdXJyZW50IGluc3RhbmNlXG4gICAgICAgICAqIEBhY2Nlc3MgcHVibGljXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl8b2JqZWN0fHN0cmluZ30gaXRlbXNcbiAgICAgICAgICogQHJldHVybiB7TGF6eVBsdWdpbn1cbiAgICAgICAgICovXG4gICAgICAgIF9pbnN0YW5jZS5hZGRJdGVtcyA9IGZ1bmN0aW9uKGl0ZW1zKSB7XG4gICAgICAgICAgICBfZXZlbnRzLmEgJiYgX2V2ZW50cy5hKCQudHlwZShpdGVtcykgPT09ICdzdHJpbmcnID8gJChpdGVtcykgOiBpdGVtcyk7IC8vIGpzaGludCBpZ25vcmUgOiBsaW5lXG4gICAgICAgICAgICByZXR1cm4gX2luc3RhbmNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VuZGVmaW5lZFByb3BlcnR5QXNzaWdubWVudFxuICAgICAgICAvKipcbiAgICAgICAgICogZ2V0IGFsbCBsZWZ0IGl0ZW1zIG9mIHRoaXMgaW5zdGFuY2VcbiAgICAgICAgICogQGFjY2VzcyBwdWJsaWNcbiAgICAgICAgICogQHJldHVybnMge29iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIF9pbnN0YW5jZS5nZXRJdGVtcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIF9ldmVudHMuZyA/IF9ldmVudHMuZygpIDoge307XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gbm9pbnNwZWN0aW9uIEpTVW5kZWZpbmVkUHJvcGVydHlBc3NpZ25tZW50XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBmb3JjZSBsYXp5IHRvIGxvYWQgYWxsIGl0ZW1zIGluIGxvYWRhYmxlIGFyZWEgcmlnaHQgbm93XG4gICAgICAgICAqIGJ5IGRlZmF1bHQgd2l0aG91dCB0aHJvdHRsZVxuICAgICAgICAgKiBAYWNjZXNzIHB1YmxpY1xuICAgICAgICAgKiBAdHlwZSB7ZnVuY3Rpb259XG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3VzZVRocm90dGxlXVxuICAgICAgICAgKiBAcmV0dXJuIHtMYXp5UGx1Z2lufVxuICAgICAgICAgKi9cbiAgICAgICAgX2luc3RhbmNlLnVwZGF0ZSA9IGZ1bmN0aW9uKHVzZVRocm90dGxlKSB7XG4gICAgICAgICAgICBfZXZlbnRzLmUgJiYgX2V2ZW50cy5lKHt9LCAhdXNlVGhyb3R0bGUpOyAvLyBqc2hpbnQgaWdub3JlIDogbGluZVxuICAgICAgICAgICAgcmV0dXJuIF9pbnN0YW5jZTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbmRlZmluZWRQcm9wZXJ0eUFzc2lnbm1lbnRcbiAgICAgICAgLyoqXG4gICAgICAgICAqIGZvcmNlIGVsZW1lbnQocykgdG8gbG9hZCBkaXJlY3RseSwgaWdub3JpbmcgdGhlIHZpZXdwb3J0XG4gICAgICAgICAqIEBhY2Nlc3MgcHVibGljXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl8b2JqZWN0fHN0cmluZ30gaXRlbXNcbiAgICAgICAgICogQHJldHVybiB7TGF6eVBsdWdpbn1cbiAgICAgICAgICovXG4gICAgICAgIF9pbnN0YW5jZS5mb3JjZSA9IGZ1bmN0aW9uKGl0ZW1zKSB7XG4gICAgICAgICAgICBfZXZlbnRzLmYgJiYgX2V2ZW50cy5mKCQudHlwZShpdGVtcykgPT09ICdzdHJpbmcnID8gJChpdGVtcykgOiBpdGVtcyk7IC8vIGpzaGludCBpZ25vcmUgOiBsaW5lXG4gICAgICAgICAgICByZXR1cm4gX2luc3RhbmNlO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VuZGVmaW5lZFByb3BlcnR5QXNzaWdubWVudFxuICAgICAgICAvKipcbiAgICAgICAgICogZm9yY2UgbGF6eSB0byBsb2FkIGFsbCBhdmFpbGFibGUgaXRlbXMgcmlnaHQgbm93XG4gICAgICAgICAqIHRoaXMgY2FsbCBpZ25vcmVzIHRocm90dGxpbmdcbiAgICAgICAgICogQGFjY2VzcyBwdWJsaWNcbiAgICAgICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHtMYXp5UGx1Z2lufVxuICAgICAgICAgKi9cbiAgICAgICAgX2luc3RhbmNlLmxvYWRBbGwgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIF9ldmVudHMuZSAmJiBfZXZlbnRzLmUoe2FsbDogdHJ1ZX0sIHRydWUpOyAvLyBqc2hpbnQgaWdub3JlIDogbGluZVxuICAgICAgICAgICAgcmV0dXJuIF9pbnN0YW5jZTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbmRlZmluZWRQcm9wZXJ0eUFzc2lnbm1lbnRcbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRlc3Ryb3kgdGhpcyBwbHVnaW4gaW5zdGFuY2VcbiAgICAgICAgICogQGFjY2VzcyBwdWJsaWNcbiAgICAgICAgICogQHR5cGUge2Z1bmN0aW9ufVxuICAgICAgICAgKiBAcmV0dXJuIHVuZGVmaW5lZFxuICAgICAgICAgKi9cbiAgICAgICAgX2luc3RhbmNlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIC8vIHVuYmluZCBpbnN0YW5jZSBnZW5lcmF0ZWQgZXZlbnRzXG4gICAgICAgICAgICAvLyBub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkRnVuY3Rpb24sIEpTVW5yZXNvbHZlZFZhcmlhYmxlXG4gICAgICAgICAgICAkKF9jb25maWcuYXBwZW5kU2Nyb2xsKS5vZmYoJy4nICsgX25hbWVzcGFjZSwgX2V2ZW50cy5lKTtcbiAgICAgICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgICAgICAgICAgJCh3aW5kb3cpLm9mZignLicgKyBfbmFtZXNwYWNlKTtcblxuICAgICAgICAgICAgLy8gY2xlYXIgZXZlbnRzXG4gICAgICAgICAgICBfZXZlbnRzID0ge307XG5cbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gc3RhcnQgdXNpbmcgbGF6eSBhbmQgcmV0dXJuIGFsbCBlbGVtZW50cyB0byBiZSBjaGFpbmFibGUgb3IgaW5zdGFuY2UgZm9yIGZ1cnRoZXIgdXNlXG4gICAgICAgIC8vIG5vaW5zcGVjdGlvbiBKU1VucmVzb2x2ZWRWYXJpYWJsZVxuICAgICAgICBfZXhlY3V0ZUxhenkoX2luc3RhbmNlLCBfY29uZmlnLCBlbGVtZW50cywgX2V2ZW50cywgX25hbWVzcGFjZSk7XG4gICAgICAgIHJldHVybiBfY29uZmlnLmNoYWluYWJsZSA/IGVsZW1lbnRzIDogX2luc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHNldHRpbmdzIGFuZCBjb25maWd1cmF0aW9uIGRhdGFcbiAgICAgKiBAYWNjZXNzIHB1YmxpY1xuICAgICAqIEB0eXBlIHtvYmplY3R8Kn1cbiAgICAgKi9cbiAgICBMYXp5UGx1Z2luLnByb3RvdHlwZS5jb25maWcgPSB7XG4gICAgICAgIC8vIGdlbmVyYWxcbiAgICAgICAgbmFtZSAgICAgICAgICAgICAgIDogJ2xhenknLFxuICAgICAgICBjaGFpbmFibGUgICAgICAgICAgOiB0cnVlLFxuICAgICAgICBhdXRvRGVzdHJveSAgICAgICAgOiB0cnVlLFxuICAgICAgICBiaW5kICAgICAgICAgICAgICAgOiAnbG9hZCcsXG4gICAgICAgIHRocmVzaG9sZCAgICAgICAgICA6IDUwMCxcbiAgICAgICAgdmlzaWJsZU9ubHkgICAgICAgIDogZmFsc2UsXG4gICAgICAgIGFwcGVuZFNjcm9sbCAgICAgICA6IHdpbmRvdyxcbiAgICAgICAgc2Nyb2xsRGlyZWN0aW9uICAgIDogJ2JvdGgnLFxuICAgICAgICBpbWFnZUJhc2UgICAgICAgICAgOiBudWxsLFxuICAgICAgICBkZWZhdWx0SW1hZ2UgICAgICAgOiAnZGF0YTppbWFnZS9naWY7YmFzZTY0LFIwbEdPRGxoQVFBQkFJQUFBUC8vL3dBQUFDSDVCQUVBQUFBQUxBQUFBQUFCQUFFQUFBSUNSQUVBT3c9PScsXG4gICAgICAgIHBsYWNlaG9sZGVyICAgICAgICA6IG51bGwsXG4gICAgICAgIGRlbGF5ICAgICAgICAgICAgICA6IC0xLFxuICAgICAgICBjb21iaW5lZCAgICAgICAgICAgOiBmYWxzZSxcblxuICAgICAgICAvLyBhdHRyaWJ1dGVzXG4gICAgICAgIGF0dHJpYnV0ZSAgICAgICAgICA6ICdkYXRhLXNyYycsXG4gICAgICAgIHNyY3NldEF0dHJpYnV0ZSAgICA6ICdkYXRhLXNyY3NldCcsXG4gICAgICAgIHNpemVzQXR0cmlidXRlICAgICA6ICdkYXRhLXNpemVzJyxcbiAgICAgICAgcmV0aW5hQXR0cmlidXRlICAgIDogJ2RhdGEtcmV0aW5hJyxcbiAgICAgICAgbG9hZGVyQXR0cmlidXRlICAgIDogJ2RhdGEtbG9hZGVyJyxcbiAgICAgICAgaW1hZ2VCYXNlQXR0cmlidXRlIDogJ2RhdGEtaW1hZ2ViYXNlJyxcbiAgICAgICAgcmVtb3ZlQXR0cmlidXRlICAgIDogdHJ1ZSxcbiAgICAgICAgaGFuZGxlZE5hbWUgICAgICAgIDogJ2hhbmRsZWQnLFxuICAgICAgICBsb2FkZWROYW1lICAgICAgICAgOiAnbG9hZGVkJyxcblxuICAgICAgICAvLyBlZmZlY3RcbiAgICAgICAgZWZmZWN0ICAgICAgICAgICAgIDogJ3Nob3cnLFxuICAgICAgICBlZmZlY3RUaW1lICAgICAgICAgOiAwLFxuXG4gICAgICAgIC8vIHRocm90dGxlXG4gICAgICAgIGVuYWJsZVRocm90dGxlICAgICA6IHRydWUsXG4gICAgICAgIHRocm90dGxlICAgICAgICAgICA6IDI1MCxcblxuICAgICAgICAvLyBjYWxsYmFja3NcbiAgICAgICAgYmVmb3JlTG9hZCAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgICBhZnRlckxvYWQgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgIG9uRXJyb3IgICAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgICAgb25GaW5pc2hlZEFsbCAgICAgIDogdW5kZWZpbmVkXG4gICAgfTtcblxuICAgIC8vIHJlZ2lzdGVyIHdpbmRvdyBsb2FkIGV2ZW50IGdsb2JhbGx5IHRvIHByZXZlbnQgbm90IGxvYWRpbmcgZWxlbWVudHNcbiAgICAvLyBzaW5jZSBqUXVlcnkgMy5YIHJlYWR5IHN0YXRlIGlzIGZ1bGx5IGFzeW5jIGFuZCBtYXkgYmUgZXhlY3V0ZWQgYWZ0ZXIgJ2xvYWQnIFxuICAgICQod2luZG93KS5vbignbG9hZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICB3aW5kb3dMb2FkZWQgPSB0cnVlO1xuICAgIH0pO1xufSkod2luZG93KTsiLCIvKlxuICogalF1ZXJ5IEVhc2luZyBDb21wYXRpYmlsaXR5IHYxIC0gaHR0cDovL2dzZ2QuY28udWsvc2FuZGJveC9qcXVlcnkuZWFzaW5nLnBocFxuICpcbiAqIEFkZHMgY29tcGF0aWJpbGl0eSBmb3IgYXBwbGljYXRpb25zIHRoYXQgdXNlIHRoZSBwcmUgMS4yIGVhc2luZyBuYW1lc1xuICpcbiAqIENvcHlyaWdodCAoYykgMjAwNyBHZW9yZ2UgU21pdGhcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZTpcbiAqICAgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5waHBcbiAqL1xuXG5qUXVlcnkuZXh0ZW5kKCBqUXVlcnkuZWFzaW5nLFxue1xuXHRlYXNlSW46IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGpRdWVyeS5lYXNpbmcuZWFzZUluUXVhZCh4LCB0LCBiLCBjLCBkKTtcblx0fSxcblx0ZWFzZU91dDogZnVuY3Rpb24gKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRyZXR1cm4galF1ZXJ5LmVhc2luZy5lYXNlT3V0UXVhZCh4LCB0LCBiLCBjLCBkKTtcblx0fSxcblx0ZWFzZUluT3V0OiBmdW5jdGlvbiAoeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiBqUXVlcnkuZWFzaW5nLmVhc2VJbk91dFF1YWQoeCwgdCwgYiwgYywgZCk7XG5cdH0sXG5cdGV4cG9pbjogZnVuY3Rpb24oeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiBqUXVlcnkuZWFzaW5nLmVhc2VJbkV4cG8oeCwgdCwgYiwgYywgZCk7XG5cdH0sXG5cdGV4cG9vdXQ6IGZ1bmN0aW9uKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRyZXR1cm4galF1ZXJ5LmVhc2luZy5lYXNlT3V0RXhwbyh4LCB0LCBiLCBjLCBkKTtcblx0fSxcblx0ZXhwb2lub3V0OiBmdW5jdGlvbih4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGpRdWVyeS5lYXNpbmcuZWFzZUluT3V0RXhwbyh4LCB0LCBiLCBjLCBkKTtcblx0fSxcblx0Ym91bmNlaW46IGZ1bmN0aW9uKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRyZXR1cm4galF1ZXJ5LmVhc2luZy5lYXNlSW5Cb3VuY2UoeCwgdCwgYiwgYywgZCk7XG5cdH0sXG5cdGJvdW5jZW91dDogZnVuY3Rpb24oeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiBqUXVlcnkuZWFzaW5nLmVhc2VPdXRCb3VuY2UoeCwgdCwgYiwgYywgZCk7XG5cdH0sXG5cdGJvdW5jZWlub3V0OiBmdW5jdGlvbih4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGpRdWVyeS5lYXNpbmcuZWFzZUluT3V0Qm91bmNlKHgsIHQsIGIsIGMsIGQpO1xuXHR9LFxuXHRlbGFzaW46IGZ1bmN0aW9uKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRyZXR1cm4galF1ZXJ5LmVhc2luZy5lYXNlSW5FbGFzdGljKHgsIHQsIGIsIGMsIGQpO1xuXHR9LFxuXHRlbGFzb3V0OiBmdW5jdGlvbih4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGpRdWVyeS5lYXNpbmcuZWFzZU91dEVsYXN0aWMoeCwgdCwgYiwgYywgZCk7XG5cdH0sXG5cdGVsYXNpbm91dDogZnVuY3Rpb24oeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiBqUXVlcnkuZWFzaW5nLmVhc2VJbk91dEVsYXN0aWMoeCwgdCwgYiwgYywgZCk7XG5cdH0sXG5cdGJhY2tpbjogZnVuY3Rpb24oeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiBqUXVlcnkuZWFzaW5nLmVhc2VJbkJhY2soeCwgdCwgYiwgYywgZCk7XG5cdH0sXG5cdGJhY2tvdXQ6IGZ1bmN0aW9uKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRyZXR1cm4galF1ZXJ5LmVhc2luZy5lYXNlT3V0QmFjayh4LCB0LCBiLCBjLCBkKTtcblx0fSxcblx0YmFja2lub3V0OiBmdW5jdGlvbih4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGpRdWVyeS5lYXNpbmcuZWFzZUluT3V0QmFjayh4LCB0LCBiLCBjLCBkKTtcblx0fVxufSk7IiwiLypcbiAqIGpRdWVyeSBFYXNpbmcgdjEuMyAtIGh0dHA6Ly9nc2dkLmNvLnVrL3NhbmRib3gvanF1ZXJ5L2Vhc2luZy9cbiAqXG4gKiBVc2VzIHRoZSBidWlsdCBpbiBlYXNpbmcgY2FwYWJpbGl0aWVzIGFkZGVkIEluIGpRdWVyeSAxLjFcbiAqIHRvIG9mZmVyIG11bHRpcGxlIGVhc2luZyBvcHRpb25zXG4gKlxuICogVEVSTVMgT0YgVVNFIC0galF1ZXJ5IEVhc2luZ1xuICogXG4gKiBPcGVuIHNvdXJjZSB1bmRlciB0aGUgQlNEIExpY2Vuc2UuIFxuICogXG4gKiBDb3B5cmlnaHQgwqkgMjAwOCBHZW9yZ2UgTWNHaW5sZXkgU21pdGhcbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiBcbiAqIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dCBtb2RpZmljYXRpb24sIFxuICogYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuICogXG4gKiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBcbiAqIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cbiAqIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSwgdGhpcyBsaXN0IFxuICogb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgXG4gKiBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG4gKiBcbiAqIE5laXRoZXIgdGhlIG5hbWUgb2YgdGhlIGF1dGhvciBub3IgdGhlIG5hbWVzIG9mIGNvbnRyaWJ1dG9ycyBtYXkgYmUgdXNlZCB0byBlbmRvcnNlIFxuICogb3IgcHJvbW90ZSBwcm9kdWN0cyBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cbiAqIFxuICogVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SUyBcIkFTIElTXCIgQU5EIEFOWSBcbiAqIEVYUFJFU1MgT1IgSU1QTElFRCBXQVJSQU5USUVTLCBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRlxuICogTUVSQ0hBTlRBQklMSVRZIEFORCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiAgQ09QWVJJR0hUIE9XTkVSIE9SIENPTlRSSUJVVE9SUyBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLFxuICogIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURVxuICogIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSwgT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBcbiAqIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gKiAgTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOIElGIEFEVklTRUQgXG4gKiBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuIFxuICpcbiovXG5cbi8vIHQ6IGN1cnJlbnQgdGltZSwgYjogYmVnSW5uSW5nIHZhbHVlLCBjOiBjaGFuZ2UgSW4gdmFsdWUsIGQ6IGR1cmF0aW9uXG5qUXVlcnkuZWFzaW5nWydqc3dpbmcnXSA9IGpRdWVyeS5lYXNpbmdbJ3N3aW5nJ107XG5cbmpRdWVyeS5leHRlbmQoIGpRdWVyeS5lYXNpbmcsXG57XG5cdGRlZjogJ2Vhc2VPdXRRdWFkJyxcblx0c3dpbmc6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0Ly9hbGVydChqUXVlcnkuZWFzaW5nLmRlZmF1bHQpO1xuXHRcdHJldHVybiBqUXVlcnkuZWFzaW5nW2pRdWVyeS5lYXNpbmcuZGVmXSh4LCB0LCBiLCBjLCBkKTtcblx0fSxcblx0ZWFzZUluUXVhZDogZnVuY3Rpb24gKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRyZXR1cm4gYyoodC89ZCkqdCArIGI7XG5cdH0sXG5cdGVhc2VPdXRRdWFkOiBmdW5jdGlvbiAoeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiAtYyAqKHQvPWQpKih0LTIpICsgYjtcblx0fSxcblx0ZWFzZUluT3V0UXVhZDogZnVuY3Rpb24gKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRpZiAoKHQvPWQvMikgPCAxKSByZXR1cm4gYy8yKnQqdCArIGI7XG5cdFx0cmV0dXJuIC1jLzIgKiAoKC0tdCkqKHQtMikgLSAxKSArIGI7XG5cdH0sXG5cdGVhc2VJbkN1YmljOiBmdW5jdGlvbiAoeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiBjKih0Lz1kKSp0KnQgKyBiO1xuXHR9LFxuXHRlYXNlT3V0Q3ViaWM6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGMqKCh0PXQvZC0xKSp0KnQgKyAxKSArIGI7XG5cdH0sXG5cdGVhc2VJbk91dEN1YmljOiBmdW5jdGlvbiAoeCwgdCwgYiwgYywgZCkge1xuXHRcdGlmICgodC89ZC8yKSA8IDEpIHJldHVybiBjLzIqdCp0KnQgKyBiO1xuXHRcdHJldHVybiBjLzIqKCh0LT0yKSp0KnQgKyAyKSArIGI7XG5cdH0sXG5cdGVhc2VJblF1YXJ0OiBmdW5jdGlvbiAoeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiBjKih0Lz1kKSp0KnQqdCArIGI7XG5cdH0sXG5cdGVhc2VPdXRRdWFydDogZnVuY3Rpb24gKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRyZXR1cm4gLWMgKiAoKHQ9dC9kLTEpKnQqdCp0IC0gMSkgKyBiO1xuXHR9LFxuXHRlYXNlSW5PdXRRdWFydDogZnVuY3Rpb24gKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRpZiAoKHQvPWQvMikgPCAxKSByZXR1cm4gYy8yKnQqdCp0KnQgKyBiO1xuXHRcdHJldHVybiAtYy8yICogKCh0LT0yKSp0KnQqdCAtIDIpICsgYjtcblx0fSxcblx0ZWFzZUluUXVpbnQ6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGMqKHQvPWQpKnQqdCp0KnQgKyBiO1xuXHR9LFxuXHRlYXNlT3V0UXVpbnQ6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGMqKCh0PXQvZC0xKSp0KnQqdCp0ICsgMSkgKyBiO1xuXHR9LFxuXHRlYXNlSW5PdXRRdWludDogZnVuY3Rpb24gKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRpZiAoKHQvPWQvMikgPCAxKSByZXR1cm4gYy8yKnQqdCp0KnQqdCArIGI7XG5cdFx0cmV0dXJuIGMvMiooKHQtPTIpKnQqdCp0KnQgKyAyKSArIGI7XG5cdH0sXG5cdGVhc2VJblNpbmU6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIC1jICogTWF0aC5jb3ModC9kICogKE1hdGguUEkvMikpICsgYyArIGI7XG5cdH0sXG5cdGVhc2VPdXRTaW5lOiBmdW5jdGlvbiAoeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiBjICogTWF0aC5zaW4odC9kICogKE1hdGguUEkvMikpICsgYjtcblx0fSxcblx0ZWFzZUluT3V0U2luZTogZnVuY3Rpb24gKHgsIHQsIGIsIGMsIGQpIHtcblx0XHRyZXR1cm4gLWMvMiAqIChNYXRoLmNvcyhNYXRoLlBJKnQvZCkgLSAxKSArIGI7XG5cdH0sXG5cdGVhc2VJbkV4cG86IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuICh0PT0wKSA/IGIgOiBjICogTWF0aC5wb3coMiwgMTAgKiAodC9kIC0gMSkpICsgYjtcblx0fSxcblx0ZWFzZU91dEV4cG86IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuICh0PT1kKSA/IGIrYyA6IGMgKiAoLU1hdGgucG93KDIsIC0xMCAqIHQvZCkgKyAxKSArIGI7XG5cdH0sXG5cdGVhc2VJbk91dEV4cG86IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0aWYgKHQ9PTApIHJldHVybiBiO1xuXHRcdGlmICh0PT1kKSByZXR1cm4gYitjO1xuXHRcdGlmICgodC89ZC8yKSA8IDEpIHJldHVybiBjLzIgKiBNYXRoLnBvdygyLCAxMCAqICh0IC0gMSkpICsgYjtcblx0XHRyZXR1cm4gYy8yICogKC1NYXRoLnBvdygyLCAtMTAgKiAtLXQpICsgMikgKyBiO1xuXHR9LFxuXHRlYXNlSW5DaXJjOiBmdW5jdGlvbiAoeCwgdCwgYiwgYywgZCkge1xuXHRcdHJldHVybiAtYyAqIChNYXRoLnNxcnQoMSAtICh0Lz1kKSp0KSAtIDEpICsgYjtcblx0fSxcblx0ZWFzZU91dENpcmM6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGMgKiBNYXRoLnNxcnQoMSAtICh0PXQvZC0xKSp0KSArIGI7XG5cdH0sXG5cdGVhc2VJbk91dENpcmM6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0aWYgKCh0Lz1kLzIpIDwgMSkgcmV0dXJuIC1jLzIgKiAoTWF0aC5zcXJ0KDEgLSB0KnQpIC0gMSkgKyBiO1xuXHRcdHJldHVybiBjLzIgKiAoTWF0aC5zcXJ0KDEgLSAodC09MikqdCkgKyAxKSArIGI7XG5cdH0sXG5cdGVhc2VJbkVsYXN0aWM6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0dmFyIHM9MS43MDE1ODt2YXIgcD0wO3ZhciBhPWM7XG5cdFx0aWYgKHQ9PTApIHJldHVybiBiOyAgaWYgKCh0Lz1kKT09MSkgcmV0dXJuIGIrYzsgIGlmICghcCkgcD1kKi4zO1xuXHRcdGlmIChhIDwgTWF0aC5hYnMoYykpIHsgYT1jOyB2YXIgcz1wLzQ7IH1cblx0XHRlbHNlIHZhciBzID0gcC8oMipNYXRoLlBJKSAqIE1hdGguYXNpbiAoYy9hKTtcblx0XHRyZXR1cm4gLShhKk1hdGgucG93KDIsMTAqKHQtPTEpKSAqIE1hdGguc2luKCAodCpkLXMpKigyKk1hdGguUEkpL3AgKSkgKyBiO1xuXHR9LFxuXHRlYXNlT3V0RWxhc3RpYzogZnVuY3Rpb24gKHgsIHQsIGIsIGMsIGQpIHtcblx0XHR2YXIgcz0xLjcwMTU4O3ZhciBwPTA7dmFyIGE9Yztcblx0XHRpZiAodD09MCkgcmV0dXJuIGI7ICBpZiAoKHQvPWQpPT0xKSByZXR1cm4gYitjOyAgaWYgKCFwKSBwPWQqLjM7XG5cdFx0aWYgKGEgPCBNYXRoLmFicyhjKSkgeyBhPWM7IHZhciBzPXAvNDsgfVxuXHRcdGVsc2UgdmFyIHMgPSBwLygyKk1hdGguUEkpICogTWF0aC5hc2luIChjL2EpO1xuXHRcdHJldHVybiBhKk1hdGgucG93KDIsLTEwKnQpICogTWF0aC5zaW4oICh0KmQtcykqKDIqTWF0aC5QSSkvcCApICsgYyArIGI7XG5cdH0sXG5cdGVhc2VJbk91dEVsYXN0aWM6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0dmFyIHM9MS43MDE1ODt2YXIgcD0wO3ZhciBhPWM7XG5cdFx0aWYgKHQ9PTApIHJldHVybiBiOyAgaWYgKCh0Lz1kLzIpPT0yKSByZXR1cm4gYitjOyAgaWYgKCFwKSBwPWQqKC4zKjEuNSk7XG5cdFx0aWYgKGEgPCBNYXRoLmFicyhjKSkgeyBhPWM7IHZhciBzPXAvNDsgfVxuXHRcdGVsc2UgdmFyIHMgPSBwLygyKk1hdGguUEkpICogTWF0aC5hc2luIChjL2EpO1xuXHRcdGlmICh0IDwgMSkgcmV0dXJuIC0uNSooYSpNYXRoLnBvdygyLDEwKih0LT0xKSkgKiBNYXRoLnNpbiggKHQqZC1zKSooMipNYXRoLlBJKS9wICkpICsgYjtcblx0XHRyZXR1cm4gYSpNYXRoLnBvdygyLC0xMCoodC09MSkpICogTWF0aC5zaW4oICh0KmQtcykqKDIqTWF0aC5QSSkvcCApKi41ICsgYyArIGI7XG5cdH0sXG5cdGVhc2VJbkJhY2s6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkLCBzKSB7XG5cdFx0aWYgKHMgPT0gdW5kZWZpbmVkKSBzID0gMS43MDE1ODtcblx0XHRyZXR1cm4gYyoodC89ZCkqdCooKHMrMSkqdCAtIHMpICsgYjtcblx0fSxcblx0ZWFzZU91dEJhY2s6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkLCBzKSB7XG5cdFx0aWYgKHMgPT0gdW5kZWZpbmVkKSBzID0gMS43MDE1ODtcblx0XHRyZXR1cm4gYyooKHQ9dC9kLTEpKnQqKChzKzEpKnQgKyBzKSArIDEpICsgYjtcblx0fSxcblx0ZWFzZUluT3V0QmFjazogZnVuY3Rpb24gKHgsIHQsIGIsIGMsIGQsIHMpIHtcblx0XHRpZiAocyA9PSB1bmRlZmluZWQpIHMgPSAxLjcwMTU4OyBcblx0XHRpZiAoKHQvPWQvMikgPCAxKSByZXR1cm4gYy8yKih0KnQqKCgocyo9KDEuNTI1KSkrMSkqdCAtIHMpKSArIGI7XG5cdFx0cmV0dXJuIGMvMiooKHQtPTIpKnQqKCgocyo9KDEuNTI1KSkrMSkqdCArIHMpICsgMikgKyBiO1xuXHR9LFxuXHRlYXNlSW5Cb3VuY2U6IGZ1bmN0aW9uICh4LCB0LCBiLCBjLCBkKSB7XG5cdFx0cmV0dXJuIGMgLSBqUXVlcnkuZWFzaW5nLmVhc2VPdXRCb3VuY2UgKHgsIGQtdCwgMCwgYywgZCkgKyBiO1xuXHR9LFxuXHRlYXNlT3V0Qm91bmNlOiBmdW5jdGlvbiAoeCwgdCwgYiwgYywgZCkge1xuXHRcdGlmICgodC89ZCkgPCAoMS8yLjc1KSkge1xuXHRcdFx0cmV0dXJuIGMqKDcuNTYyNSp0KnQpICsgYjtcblx0XHR9IGVsc2UgaWYgKHQgPCAoMi8yLjc1KSkge1xuXHRcdFx0cmV0dXJuIGMqKDcuNTYyNSoodC09KDEuNS8yLjc1KSkqdCArIC43NSkgKyBiO1xuXHRcdH0gZWxzZSBpZiAodCA8ICgyLjUvMi43NSkpIHtcblx0XHRcdHJldHVybiBjKig3LjU2MjUqKHQtPSgyLjI1LzIuNzUpKSp0ICsgLjkzNzUpICsgYjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGMqKDcuNTYyNSoodC09KDIuNjI1LzIuNzUpKSp0ICsgLjk4NDM3NSkgKyBiO1xuXHRcdH1cblx0fSxcblx0ZWFzZUluT3V0Qm91bmNlOiBmdW5jdGlvbiAoeCwgdCwgYiwgYywgZCkge1xuXHRcdGlmICh0IDwgZC8yKSByZXR1cm4galF1ZXJ5LmVhc2luZy5lYXNlSW5Cb3VuY2UgKHgsIHQqMiwgMCwgYywgZCkgKiAuNSArIGI7XG5cdFx0cmV0dXJuIGpRdWVyeS5lYXNpbmcuZWFzZU91dEJvdW5jZSAoeCwgdCoyLWQsIDAsIGMsIGQpICogLjUgKyBjKi41ICsgYjtcblx0fVxufSk7XG5cbi8qXG4gKlxuICogVEVSTVMgT0YgVVNFIC0gRUFTSU5HIEVRVUFUSU9OU1xuICogXG4gKiBPcGVuIHNvdXJjZSB1bmRlciB0aGUgQlNEIExpY2Vuc2UuIFxuICogXG4gKiBDb3B5cmlnaHQgwqkgMjAwMSBSb2JlcnQgUGVubmVyXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXQgbW9kaWZpY2F0aW9uLCBcbiAqIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcbiAqIFxuICogUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLCB0aGlzIGxpc3Qgb2YgXG4gKiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gKiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBcbiAqIG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIFxuICogcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuICogXG4gKiBOZWl0aGVyIHRoZSBuYW1lIG9mIHRoZSBhdXRob3Igbm9yIHRoZSBuYW1lcyBvZiBjb250cmlidXRvcnMgbWF5IGJlIHVzZWQgdG8gZW5kb3JzZSBcbiAqIG9yIHByb21vdGUgcHJvZHVjdHMgZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG4gKiBcbiAqIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgQlkgVEhFIENPUFlSSUdIVCBIT0xERVJTIEFORCBDT05UUklCVVRPUlMgXCJBUyBJU1wiIEFORCBBTlkgXG4gKiBFWFBSRVNTIE9SIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0ZcbiAqIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRVxuICogIENPUFlSSUdIVCBPV05FUiBPUiBDT05UUklCVVRPUlMgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCwgSU5DSURFTlRBTCwgU1BFQ0lBTCxcbiAqICBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEVcbiAqICBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgXG4gKiBBTkQgT04gQU5ZIFRIRU9SWSBPRiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuICogIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSwgRVZFTiBJRiBBRFZJU0VEIFxuICogT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLiBcbiAqXG4gKi8iLCIvKlxuICogalF1ZXJ5IG1tZW51IHY1LjcuOFxuICogQHJlcXVpcmVzIGpRdWVyeSAxLjcuMCBvciBsYXRlclxuICpcbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlx0XG4gKiBDb3B5cmlnaHQgKGMpIEZyZWQgSGV1c3NjaGVuXG4gKiB3d3cuZnJlYnNpdGUubmxcbiAqXG4gKiBMaWNlbnNlOiBDQy1CWS1OQy00LjBcbiAqIGh0dHA6Ly9jcmVhdGl2ZWNvbW1vbnMub3JnL2xpY2Vuc2VzL2J5LW5jLzQuMC9cbiAqL1xuIWZ1bmN0aW9uKGUpe2Z1bmN0aW9uIG4oKXtlW3RdLmdsYmx8fChyPXskd25kdzplKHdpbmRvdyksJGRvY3U6ZShkb2N1bWVudCksJGh0bWw6ZShcImh0bWxcIiksJGJvZHk6ZShcImJvZHlcIil9LHM9e30sYT17fSxvPXt9LGUuZWFjaChbcyxhLG9dLGZ1bmN0aW9uKGUsbil7bi5hZGQ9ZnVuY3Rpb24oZSl7ZT1lLnNwbGl0KFwiIFwiKTtmb3IodmFyIHQ9MCxpPWUubGVuZ3RoO3Q8aTt0KyspbltlW3RdXT1uLm1tKGVbdF0pfX0pLHMubW09ZnVuY3Rpb24oZSl7cmV0dXJuXCJtbS1cIitlfSxzLmFkZChcIndyYXBwZXIgbWVudSBwYW5lbHMgcGFuZWwgbm9wYW5lbCBjdXJyZW50IGhpZ2hlc3Qgb3BlbmVkIHN1Ym9wZW5lZCBuYXZiYXIgaGFzbmF2YmFyIHRpdGxlIGJ0biBwcmV2IG5leHQgbGlzdHZpZXcgbm9saXN0dmlldyBpbnNldCB2ZXJ0aWNhbCBzZWxlY3RlZCBkaXZpZGVyIHNwYWNlciBoaWRkZW4gZnVsbHN1Ym9wZW5cIikscy51bW09ZnVuY3Rpb24oZSl7cmV0dXJuXCJtbS1cIj09ZS5zbGljZSgwLDMpJiYoZT1lLnNsaWNlKDMpKSxlfSxhLm1tPWZ1bmN0aW9uKGUpe3JldHVyblwibW0tXCIrZX0sYS5hZGQoXCJwYXJlbnQgY2hpbGRcIiksby5tbT1mdW5jdGlvbihlKXtyZXR1cm4gZStcIi5tbVwifSxvLmFkZChcInRyYW5zaXRpb25lbmQgd2Via2l0VHJhbnNpdGlvbkVuZCBjbGljayBzY3JvbGwga2V5ZG93biBtb3VzZWRvd24gbW91c2V1cCB0b3VjaHN0YXJ0IHRvdWNobW92ZSB0b3VjaGVuZCBvcmllbnRhdGlvbmNoYW5nZVwiKSxlW3RdLl9jPXMsZVt0XS5fZD1hLGVbdF0uX2U9byxlW3RdLmdsYmw9cil9dmFyIHQ9XCJtbWVudVwiLGk9XCI1LjcuOFwiO2lmKCEoZVt0XSYmZVt0XS52ZXJzaW9uPmkpKXtlW3RdPWZ1bmN0aW9uKGUsbix0KXt0aGlzLiRtZW51PWUsdGhpcy5fYXBpPVtcImJpbmRcIixcImdldEluc3RhbmNlXCIsXCJ1cGRhdGVcIixcImluaXRQYW5lbHNcIixcIm9wZW5QYW5lbFwiLFwiY2xvc2VQYW5lbFwiLFwiY2xvc2VBbGxQYW5lbHNcIixcInNldFNlbGVjdGVkXCJdLHRoaXMub3B0cz1uLHRoaXMuY29uZj10LHRoaXMudmFycz17fSx0aGlzLmNiY2s9e30sXCJmdW5jdGlvblwiPT10eXBlb2YgdGhpcy5fX19kZXByZWNhdGVkJiZ0aGlzLl9fX2RlcHJlY2F0ZWQoKSx0aGlzLl9pbml0TWVudSgpLHRoaXMuX2luaXRBbmNob3JzKCk7dmFyIGk9dGhpcy4kcG5scy5jaGlsZHJlbigpO3JldHVybiB0aGlzLl9pbml0QWRkb25zKCksdGhpcy5pbml0UGFuZWxzKGkpLFwiZnVuY3Rpb25cIj09dHlwZW9mIHRoaXMuX19fZGVidWcmJnRoaXMuX19fZGVidWcoKSx0aGlzfSxlW3RdLnZlcnNpb249aSxlW3RdLmFkZG9ucz17fSxlW3RdLnVuaXF1ZUlkPTAsZVt0XS5kZWZhdWx0cz17ZXh0ZW5zaW9uczpbXSxpbml0TWVudTpmdW5jdGlvbigpe30saW5pdFBhbmVsczpmdW5jdGlvbigpe30sbmF2YmFyOnthZGQ6ITAsdGl0bGU6XCJNZW51XCIsdGl0bGVMaW5rOlwicGFuZWxcIn0sb25DbGljazp7c2V0U2VsZWN0ZWQ6ITB9LHNsaWRpbmdTdWJtZW51czohMH0sZVt0XS5jb25maWd1cmF0aW9uPXtjbGFzc05hbWVzOntkaXZpZGVyOlwiRGl2aWRlclwiLGluc2V0OlwiSW5zZXRcIixwYW5lbDpcIlBhbmVsXCIsc2VsZWN0ZWQ6XCJTZWxlY3RlZFwiLHNwYWNlcjpcIlNwYWNlclwiLHZlcnRpY2FsOlwiVmVydGljYWxcIn0sY2xvbmU6ITEsb3BlbmluZ0ludGVydmFsOjI1LHBhbmVsTm9kZXR5cGU6XCJ1bCwgb2wsIGRpdlwiLHRyYW5zaXRpb25EdXJhdGlvbjo0MDB9LGVbdF0ucHJvdG90eXBlPXtpbml0OmZ1bmN0aW9uKGUpe3RoaXMuaW5pdFBhbmVscyhlKX0sZ2V0SW5zdGFuY2U6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpc30sdXBkYXRlOmZ1bmN0aW9uKCl7dGhpcy50cmlnZ2VyKFwidXBkYXRlXCIpfSxpbml0UGFuZWxzOmZ1bmN0aW9uKGUpe2U9ZS5ub3QoXCIuXCIrcy5ub3BhbmVsKSxlPXRoaXMuX2luaXRQYW5lbHMoZSksdGhpcy5vcHRzLmluaXRQYW5lbHMuY2FsbCh0aGlzLGUpLHRoaXMudHJpZ2dlcihcImluaXRQYW5lbHNcIixlKSx0aGlzLnRyaWdnZXIoXCJ1cGRhdGVcIil9LG9wZW5QYW5lbDpmdW5jdGlvbihuKXt2YXIgaT1uLnBhcmVudCgpLGE9dGhpcztpZihpLmhhc0NsYXNzKHMudmVydGljYWwpKXt2YXIgbz1pLnBhcmVudHMoXCIuXCIrcy5zdWJvcGVuZWQpO2lmKG8ubGVuZ3RoKXJldHVybiB2b2lkIHRoaXMub3BlblBhbmVsKG8uZmlyc3QoKSk7aS5hZGRDbGFzcyhzLm9wZW5lZCksdGhpcy50cmlnZ2VyKFwib3BlblBhbmVsXCIsbiksdGhpcy50cmlnZ2VyKFwib3BlbmluZ1BhbmVsXCIsbiksdGhpcy50cmlnZ2VyKFwib3BlbmVkUGFuZWxcIixuKX1lbHNle2lmKG4uaGFzQ2xhc3Mocy5jdXJyZW50KSlyZXR1cm47dmFyIHI9dGhpcy4kcG5scy5jaGlsZHJlbihcIi5cIitzLnBhbmVsKSxsPXIuZmlsdGVyKFwiLlwiK3MuY3VycmVudCk7ci5yZW1vdmVDbGFzcyhzLmhpZ2hlc3QpLnJlbW92ZUNsYXNzKHMuY3VycmVudCkubm90KG4pLm5vdChsKS5ub3QoXCIuXCIrcy52ZXJ0aWNhbCkuYWRkQ2xhc3Mocy5oaWRkZW4pLGVbdF0uc3VwcG9ydC5jc3N0cmFuc2l0aW9uc3x8bC5hZGRDbGFzcyhzLmhpZGRlbiksbi5oYXNDbGFzcyhzLm9wZW5lZCk/bi5uZXh0QWxsKFwiLlwiK3Mub3BlbmVkKS5hZGRDbGFzcyhzLmhpZ2hlc3QpLnJlbW92ZUNsYXNzKHMub3BlbmVkKS5yZW1vdmVDbGFzcyhzLnN1Ym9wZW5lZCk6KG4uYWRkQ2xhc3Mocy5oaWdoZXN0KSxsLmFkZENsYXNzKHMuc3Vib3BlbmVkKSksbi5yZW1vdmVDbGFzcyhzLmhpZGRlbikuYWRkQ2xhc3Mocy5jdXJyZW50KSxhLnRyaWdnZXIoXCJvcGVuUGFuZWxcIixuKSxzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7bi5yZW1vdmVDbGFzcyhzLnN1Ym9wZW5lZCkuYWRkQ2xhc3Mocy5vcGVuZWQpLGEudHJpZ2dlcihcIm9wZW5pbmdQYW5lbFwiLG4pLGEuX190cmFuc2l0aW9uZW5kKG4sZnVuY3Rpb24oKXthLnRyaWdnZXIoXCJvcGVuZWRQYW5lbFwiLG4pfSxhLmNvbmYudHJhbnNpdGlvbkR1cmF0aW9uKX0sdGhpcy5jb25mLm9wZW5pbmdJbnRlcnZhbCl9fSxjbG9zZVBhbmVsOmZ1bmN0aW9uKGUpe3ZhciBuPWUucGFyZW50KCk7bi5oYXNDbGFzcyhzLnZlcnRpY2FsKSYmKG4ucmVtb3ZlQ2xhc3Mocy5vcGVuZWQpLHRoaXMudHJpZ2dlcihcImNsb3NlUGFuZWxcIixlKSx0aGlzLnRyaWdnZXIoXCJjbG9zaW5nUGFuZWxcIixlKSx0aGlzLnRyaWdnZXIoXCJjbG9zZWRQYW5lbFwiLGUpKX0sY2xvc2VBbGxQYW5lbHM6ZnVuY3Rpb24oKXt0aGlzLiRtZW51LmZpbmQoXCIuXCIrcy5saXN0dmlldykuY2hpbGRyZW4oKS5yZW1vdmVDbGFzcyhzLnNlbGVjdGVkKS5maWx0ZXIoXCIuXCIrcy52ZXJ0aWNhbCkucmVtb3ZlQ2xhc3Mocy5vcGVuZWQpO3ZhciBlPXRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIrcy5wYW5lbCksbj1lLmZpcnN0KCk7dGhpcy4kcG5scy5jaGlsZHJlbihcIi5cIitzLnBhbmVsKS5ub3QobikucmVtb3ZlQ2xhc3Mocy5zdWJvcGVuZWQpLnJlbW92ZUNsYXNzKHMub3BlbmVkKS5yZW1vdmVDbGFzcyhzLmN1cnJlbnQpLnJlbW92ZUNsYXNzKHMuaGlnaGVzdCkuYWRkQ2xhc3Mocy5oaWRkZW4pLHRoaXMub3BlblBhbmVsKG4pfSx0b2dnbGVQYW5lbDpmdW5jdGlvbihlKXt2YXIgbj1lLnBhcmVudCgpO24uaGFzQ2xhc3Mocy52ZXJ0aWNhbCkmJnRoaXNbbi5oYXNDbGFzcyhzLm9wZW5lZCk/XCJjbG9zZVBhbmVsXCI6XCJvcGVuUGFuZWxcIl0oZSl9LHNldFNlbGVjdGVkOmZ1bmN0aW9uKGUpe3RoaXMuJG1lbnUuZmluZChcIi5cIitzLmxpc3R2aWV3KS5jaGlsZHJlbihcIi5cIitzLnNlbGVjdGVkKS5yZW1vdmVDbGFzcyhzLnNlbGVjdGVkKSxlLmFkZENsYXNzKHMuc2VsZWN0ZWQpLHRoaXMudHJpZ2dlcihcInNldFNlbGVjdGVkXCIsZSl9LGJpbmQ6ZnVuY3Rpb24oZSxuKXtlPVwiaW5pdFwiPT1lP1wiaW5pdFBhbmVsc1wiOmUsdGhpcy5jYmNrW2VdPXRoaXMuY2Jja1tlXXx8W10sdGhpcy5jYmNrW2VdLnB1c2gobil9LHRyaWdnZXI6ZnVuY3Rpb24oKXt2YXIgZT10aGlzLG49QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSx0PW4uc2hpZnQoKTtpZih0PVwiaW5pdFwiPT10P1wiaW5pdFBhbmVsc1wiOnQsdGhpcy5jYmNrW3RdKWZvcih2YXIgaT0wLHM9dGhpcy5jYmNrW3RdLmxlbmd0aDtpPHM7aSsrKXRoaXMuY2Jja1t0XVtpXS5hcHBseShlLG4pfSxfaW5pdE1lbnU6ZnVuY3Rpb24oKXt0aGlzLmNvbmYuY2xvbmUmJih0aGlzLiRvcmlnPXRoaXMuJG1lbnUsdGhpcy4kbWVudT10aGlzLiRvcmlnLmNsb25lKCEwKSx0aGlzLiRtZW51LmFkZCh0aGlzLiRtZW51LmZpbmQoXCJbaWRdXCIpKS5maWx0ZXIoXCJbaWRdXCIpLmVhY2goZnVuY3Rpb24oKXtlKHRoaXMpLmF0dHIoXCJpZFwiLHMubW0oZSh0aGlzKS5hdHRyKFwiaWRcIikpKX0pKSx0aGlzLm9wdHMuaW5pdE1lbnUuY2FsbCh0aGlzLHRoaXMuJG1lbnUsdGhpcy4kb3JpZyksdGhpcy4kbWVudS5hdHRyKFwiaWRcIix0aGlzLiRtZW51LmF0dHIoXCJpZFwiKXx8dGhpcy5fX2dldFVuaXF1ZUlkKCkpLHRoaXMuJHBubHM9ZSgnPGRpdiBjbGFzcz1cIicrcy5wYW5lbHMrJ1wiIC8+JykuYXBwZW5kKHRoaXMuJG1lbnUuY2hpbGRyZW4odGhpcy5jb25mLnBhbmVsTm9kZXR5cGUpKS5wcmVwZW5kVG8odGhpcy4kbWVudSksdGhpcy4kbWVudS5wYXJlbnQoKS5hZGRDbGFzcyhzLndyYXBwZXIpO3ZhciBuPVtzLm1lbnVdO3RoaXMub3B0cy5zbGlkaW5nU3VibWVudXN8fG4ucHVzaChzLnZlcnRpY2FsKSx0aGlzLm9wdHMuZXh0ZW5zaW9ucz10aGlzLm9wdHMuZXh0ZW5zaW9ucy5sZW5ndGg/XCJtbS1cIit0aGlzLm9wdHMuZXh0ZW5zaW9ucy5qb2luKFwiIG1tLVwiKTpcIlwiLHRoaXMub3B0cy5leHRlbnNpb25zJiZuLnB1c2godGhpcy5vcHRzLmV4dGVuc2lvbnMpLHRoaXMuJG1lbnUuYWRkQ2xhc3Mobi5qb2luKFwiIFwiKSksdGhpcy50cmlnZ2VyKFwiX2luaXRNZW51XCIpfSxfaW5pdFBhbmVsczpmdW5jdGlvbihuKXt2YXIgaT10aGlzLG89dGhpcy5fX2ZpbmRBZGRCYWNrKG4sXCJ1bCwgb2xcIik7dGhpcy5fX3JlZmFjdG9yQ2xhc3Mobyx0aGlzLmNvbmYuY2xhc3NOYW1lcy5pbnNldCxcImluc2V0XCIpLmFkZENsYXNzKHMubm9saXN0dmlldytcIiBcIitzLm5vcGFuZWwpLG8ubm90KFwiLlwiK3Mubm9saXN0dmlldykuYWRkQ2xhc3Mocy5saXN0dmlldyk7dmFyIHI9dGhpcy5fX2ZpbmRBZGRCYWNrKG4sXCIuXCIrcy5saXN0dmlldykuY2hpbGRyZW4oKTt0aGlzLl9fcmVmYWN0b3JDbGFzcyhyLHRoaXMuY29uZi5jbGFzc05hbWVzLnNlbGVjdGVkLFwic2VsZWN0ZWRcIiksdGhpcy5fX3JlZmFjdG9yQ2xhc3Mocix0aGlzLmNvbmYuY2xhc3NOYW1lcy5kaXZpZGVyLFwiZGl2aWRlclwiKSx0aGlzLl9fcmVmYWN0b3JDbGFzcyhyLHRoaXMuY29uZi5jbGFzc05hbWVzLnNwYWNlcixcInNwYWNlclwiKSx0aGlzLl9fcmVmYWN0b3JDbGFzcyh0aGlzLl9fZmluZEFkZEJhY2sobixcIi5cIit0aGlzLmNvbmYuY2xhc3NOYW1lcy5wYW5lbCksdGhpcy5jb25mLmNsYXNzTmFtZXMucGFuZWwsXCJwYW5lbFwiKTt2YXIgbD1lKCksZD1uLmFkZChuLmZpbmQoXCIuXCIrcy5wYW5lbCkpLmFkZCh0aGlzLl9fZmluZEFkZEJhY2sobixcIi5cIitzLmxpc3R2aWV3KS5jaGlsZHJlbigpLmNoaWxkcmVuKHRoaXMuY29uZi5wYW5lbE5vZGV0eXBlKSkubm90KFwiLlwiK3Mubm9wYW5lbCk7dGhpcy5fX3JlZmFjdG9yQ2xhc3MoZCx0aGlzLmNvbmYuY2xhc3NOYW1lcy52ZXJ0aWNhbCxcInZlcnRpY2FsXCIpLHRoaXMub3B0cy5zbGlkaW5nU3VibWVudXN8fGQuYWRkQ2xhc3Mocy52ZXJ0aWNhbCksZC5lYWNoKGZ1bmN0aW9uKCl7dmFyIG49ZSh0aGlzKSx0PW47bi5pcyhcInVsLCBvbFwiKT8obi53cmFwKCc8ZGl2IGNsYXNzPVwiJytzLnBhbmVsKydcIiAvPicpLHQ9bi5wYXJlbnQoKSk6dC5hZGRDbGFzcyhzLnBhbmVsKTt2YXIgYT1uLmF0dHIoXCJpZFwiKTtuLnJlbW92ZUF0dHIoXCJpZFwiKSx0LmF0dHIoXCJpZFwiLGF8fGkuX19nZXRVbmlxdWVJZCgpKSxuLmhhc0NsYXNzKHMudmVydGljYWwpJiYobi5yZW1vdmVDbGFzcyhpLmNvbmYuY2xhc3NOYW1lcy52ZXJ0aWNhbCksdC5hZGQodC5wYXJlbnQoKSkuYWRkQ2xhc3Mocy52ZXJ0aWNhbCkpLGw9bC5hZGQodCl9KTt2YXIgYz1lKFwiLlwiK3MucGFuZWwsdGhpcy4kbWVudSk7bC5lYWNoKGZ1bmN0aW9uKG4pe3ZhciBvLHIsbD1lKHRoaXMpLGQ9bC5wYXJlbnQoKSxjPWQuY2hpbGRyZW4oXCJhLCBzcGFuXCIpLmZpcnN0KCk7aWYoZC5pcyhcIi5cIitzLnBhbmVscyl8fChkLmRhdGEoYS5jaGlsZCxsKSxsLmRhdGEoYS5wYXJlbnQsZCkpLGQuY2hpbGRyZW4oXCIuXCIrcy5uZXh0KS5sZW5ndGh8fGQucGFyZW50KCkuaXMoXCIuXCIrcy5saXN0dmlldykmJihvPWwuYXR0cihcImlkXCIpLHI9ZSgnPGEgY2xhc3M9XCInK3MubmV4dCsnXCIgaHJlZj1cIiMnK28rJ1wiIGRhdGEtdGFyZ2V0PVwiIycrbysnXCIgLz4nKS5pbnNlcnRCZWZvcmUoYyksYy5pcyhcInNwYW5cIikmJnIuYWRkQ2xhc3Mocy5mdWxsc3Vib3BlbikpLCFsLmNoaWxkcmVuKFwiLlwiK3MubmF2YmFyKS5sZW5ndGgmJiFkLmhhc0NsYXNzKHMudmVydGljYWwpKXtkLnBhcmVudCgpLmlzKFwiLlwiK3MubGlzdHZpZXcpP2Q9ZC5jbG9zZXN0KFwiLlwiK3MucGFuZWwpOihjPWQuY2xvc2VzdChcIi5cIitzLnBhbmVsKS5maW5kKCdhW2hyZWY9XCIjJytsLmF0dHIoXCJpZFwiKSsnXCJdJykuZmlyc3QoKSxkPWMuY2xvc2VzdChcIi5cIitzLnBhbmVsKSk7dmFyIGg9ITEsdT1lKCc8ZGl2IGNsYXNzPVwiJytzLm5hdmJhcisnXCIgLz4nKTtpZihpLm9wdHMubmF2YmFyLmFkZCYmbC5hZGRDbGFzcyhzLmhhc25hdmJhciksZC5sZW5ndGgpe3N3aXRjaChvPWQuYXR0cihcImlkXCIpLGkub3B0cy5uYXZiYXIudGl0bGVMaW5rKXtjYXNlXCJhbmNob3JcIjpoPWMuYXR0cihcImhyZWZcIik7YnJlYWs7Y2FzZVwicGFuZWxcIjpjYXNlXCJwYXJlbnRcIjpoPVwiI1wiK287YnJlYWs7ZGVmYXVsdDpoPSExfXUuYXBwZW5kKCc8YSBjbGFzcz1cIicrcy5idG4rXCIgXCIrcy5wcmV2KydcIiBocmVmPVwiIycrbysnXCIgZGF0YS10YXJnZXQ9XCIjJytvKydcIiAvPicpLmFwcGVuZChlKCc8YSBjbGFzcz1cIicrcy50aXRsZSsnXCInKyhoPycgaHJlZj1cIicraCsnXCInOlwiXCIpK1wiIC8+XCIpLnRleHQoYy50ZXh0KCkpKS5wcmVwZW5kVG8obCl9ZWxzZSBpLm9wdHMubmF2YmFyLnRpdGxlJiZ1LmFwcGVuZCgnPGEgY2xhc3M9XCInK3MudGl0bGUrJ1wiPicrZVt0XS5pMThuKGkub3B0cy5uYXZiYXIudGl0bGUpK1wiPC9hPlwiKS5wcmVwZW5kVG8obCl9fSk7dmFyIGg9dGhpcy5fX2ZpbmRBZGRCYWNrKG4sXCIuXCIrcy5saXN0dmlldykuY2hpbGRyZW4oXCIuXCIrcy5zZWxlY3RlZCkucmVtb3ZlQ2xhc3Mocy5zZWxlY3RlZCkubGFzdCgpLmFkZENsYXNzKHMuc2VsZWN0ZWQpO2guYWRkKGgucGFyZW50c1VudGlsKFwiLlwiK3MubWVudSxcImxpXCIpKS5maWx0ZXIoXCIuXCIrcy52ZXJ0aWNhbCkuYWRkQ2xhc3Mocy5vcGVuZWQpLmVuZCgpLmVhY2goZnVuY3Rpb24oKXtlKHRoaXMpLnBhcmVudHNVbnRpbChcIi5cIitzLm1lbnUsXCIuXCIrcy5wYW5lbCkubm90KFwiLlwiK3MudmVydGljYWwpLmZpcnN0KCkuYWRkQ2xhc3Mocy5vcGVuZWQpLnBhcmVudHNVbnRpbChcIi5cIitzLm1lbnUsXCIuXCIrcy5wYW5lbCkubm90KFwiLlwiK3MudmVydGljYWwpLmZpcnN0KCkuYWRkQ2xhc3Mocy5vcGVuZWQpLmFkZENsYXNzKHMuc3Vib3BlbmVkKX0pLGguY2hpbGRyZW4oXCIuXCIrcy5wYW5lbCkubm90KFwiLlwiK3MudmVydGljYWwpLmFkZENsYXNzKHMub3BlbmVkKS5wYXJlbnRzVW50aWwoXCIuXCIrcy5tZW51LFwiLlwiK3MucGFuZWwpLm5vdChcIi5cIitzLnZlcnRpY2FsKS5maXJzdCgpLmFkZENsYXNzKHMub3BlbmVkKS5hZGRDbGFzcyhzLnN1Ym9wZW5lZCk7dmFyIHU9Yy5maWx0ZXIoXCIuXCIrcy5vcGVuZWQpO3JldHVybiB1Lmxlbmd0aHx8KHU9bC5maXJzdCgpKSx1LmFkZENsYXNzKHMub3BlbmVkKS5sYXN0KCkuYWRkQ2xhc3Mocy5jdXJyZW50KSxsLm5vdChcIi5cIitzLnZlcnRpY2FsKS5ub3QodS5sYXN0KCkpLmFkZENsYXNzKHMuaGlkZGVuKS5lbmQoKS5maWx0ZXIoZnVuY3Rpb24oKXtyZXR1cm4hZSh0aGlzKS5wYXJlbnQoKS5oYXNDbGFzcyhzLnBhbmVscyl9KS5hcHBlbmRUbyh0aGlzLiRwbmxzKSx0aGlzLnRyaWdnZXIoXCJfaW5pdFBhbmVsc1wiLGwpLGx9LF9pbml0QW5jaG9yczpmdW5jdGlvbigpe3ZhciBuPXRoaXM7ci4kYm9keS5vbihvLmNsaWNrK1wiLW9uY2FudmFzXCIsXCJhW2hyZWZdXCIsZnVuY3Rpb24oaSl7dmFyIGE9ZSh0aGlzKSxvPSExLHI9bi4kbWVudS5maW5kKGEpLmxlbmd0aDtmb3IodmFyIGwgaW4gZVt0XS5hZGRvbnMpaWYoZVt0XS5hZGRvbnNbbF0uY2xpY2tBbmNob3IuY2FsbChuLGEscikpe289ITA7YnJlYWt9dmFyIGQ9YS5hdHRyKFwiaHJlZlwiKTtpZighbyYmciYmZC5sZW5ndGg+MSYmXCIjXCI9PWQuc2xpY2UoMCwxKSl0cnl7dmFyIGM9ZShkLG4uJG1lbnUpO2MuaXMoXCIuXCIrcy5wYW5lbCkmJihvPSEwLG5bYS5wYXJlbnQoKS5oYXNDbGFzcyhzLnZlcnRpY2FsKT9cInRvZ2dsZVBhbmVsXCI6XCJvcGVuUGFuZWxcIl0oYykpfWNhdGNoKGgpe31pZihvJiZpLnByZXZlbnREZWZhdWx0KCksIW8mJnImJmEuaXMoXCIuXCIrcy5saXN0dmlldytcIiA+IGxpID4gYVwiKSYmIWEuaXMoJ1tyZWw9XCJleHRlcm5hbFwiXScpJiYhYS5pcygnW3RhcmdldD1cIl9ibGFua1wiXScpKXtuLl9fdmFsdWVPckZuKG4ub3B0cy5vbkNsaWNrLnNldFNlbGVjdGVkLGEpJiZuLnNldFNlbGVjdGVkKGUoaS50YXJnZXQpLnBhcmVudCgpKTt2YXIgdT1uLl9fdmFsdWVPckZuKG4ub3B0cy5vbkNsaWNrLnByZXZlbnREZWZhdWx0LGEsXCIjXCI9PWQuc2xpY2UoMCwxKSk7dSYmaS5wcmV2ZW50RGVmYXVsdCgpLG4uX192YWx1ZU9yRm4obi5vcHRzLm9uQ2xpY2suY2xvc2UsYSx1KSYmbi5jbG9zZSgpfX0pLHRoaXMudHJpZ2dlcihcIl9pbml0QW5jaG9yc1wiKX0sX2luaXRBZGRvbnM6ZnVuY3Rpb24oKXt2YXIgbjtmb3IobiBpbiBlW3RdLmFkZG9ucyllW3RdLmFkZG9uc1tuXS5hZGQuY2FsbCh0aGlzKSxlW3RdLmFkZG9uc1tuXS5hZGQ9ZnVuY3Rpb24oKXt9O2ZvcihuIGluIGVbdF0uYWRkb25zKWVbdF0uYWRkb25zW25dLnNldHVwLmNhbGwodGhpcyk7dGhpcy50cmlnZ2VyKFwiX2luaXRBZGRvbnNcIil9LF9nZXRPcmlnaW5hbE1lbnVJZDpmdW5jdGlvbigpe3ZhciBlPXRoaXMuJG1lbnUuYXR0cihcImlkXCIpO3JldHVybiBlJiZlLmxlbmd0aCYmdGhpcy5jb25mLmNsb25lJiYoZT1zLnVtbShlKSksZX0sX19hcGk6ZnVuY3Rpb24oKXt2YXIgbj10aGlzLHQ9e307cmV0dXJuIGUuZWFjaCh0aGlzLl9hcGksZnVuY3Rpb24oZSl7dmFyIGk9dGhpczt0W2ldPWZ1bmN0aW9uKCl7dmFyIGU9bltpXS5hcHBseShuLGFyZ3VtZW50cyk7cmV0dXJuXCJ1bmRlZmluZWRcIj09dHlwZW9mIGU/dDplfX0pLHR9LF9fdmFsdWVPckZuOmZ1bmN0aW9uKGUsbix0KXtyZXR1cm5cImZ1bmN0aW9uXCI9PXR5cGVvZiBlP2UuY2FsbChuWzBdKTpcInVuZGVmaW5lZFwiPT10eXBlb2YgZSYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIHQ/dDplfSxfX3JlZmFjdG9yQ2xhc3M6ZnVuY3Rpb24oZSxuLHQpe3JldHVybiBlLmZpbHRlcihcIi5cIituKS5yZW1vdmVDbGFzcyhuKS5hZGRDbGFzcyhzW3RdKX0sX19maW5kQWRkQmFjazpmdW5jdGlvbihlLG4pe3JldHVybiBlLmZpbmQobikuYWRkKGUuZmlsdGVyKG4pKX0sX19maWx0ZXJMaXN0SXRlbXM6ZnVuY3Rpb24oZSl7cmV0dXJuIGUubm90KFwiLlwiK3MuZGl2aWRlcikubm90KFwiLlwiK3MuaGlkZGVuKX0sX190cmFuc2l0aW9uZW5kOmZ1bmN0aW9uKG4sdCxpKXt2YXIgcz0hMSxhPWZ1bmN0aW9uKGkpe2lmKFwidW5kZWZpbmVkXCIhPXR5cGVvZiBpKXtpZighZShpLnRhcmdldCkuaXMobikpcmV0dXJuITE7bi51bmJpbmQoby50cmFuc2l0aW9uZW5kKSxuLnVuYmluZChvLndlYmtpdFRyYW5zaXRpb25FbmQpfXN8fHQuY2FsbChuWzBdKSxzPSEwfTtuLm9uKG8udHJhbnNpdGlvbmVuZCxhKSxuLm9uKG8ud2Via2l0VHJhbnNpdGlvbkVuZCxhKSxzZXRUaW1lb3V0KGEsMS4xKmkpfSxfX2dldFVuaXF1ZUlkOmZ1bmN0aW9uKCl7cmV0dXJuIHMubW0oZVt0XS51bmlxdWVJZCsrKX19LGUuZm5bdF09ZnVuY3Rpb24oaSxzKXtuKCksaT1lLmV4dGVuZCghMCx7fSxlW3RdLmRlZmF1bHRzLGkpLHM9ZS5leHRlbmQoITAse30sZVt0XS5jb25maWd1cmF0aW9uLHMpO3ZhciBhPWUoKTtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7dmFyIG49ZSh0aGlzKTtpZighbi5kYXRhKHQpKXt2YXIgbz1uZXcgZVt0XShuLGkscyk7by4kbWVudS5kYXRhKHQsby5fX2FwaSgpKSxhPWEuYWRkKG8uJG1lbnUpfX0pLGF9LGVbdF0uaTE4bj1mdW5jdGlvbigpe3ZhciBuPXt9O3JldHVybiBmdW5jdGlvbih0KXtzd2l0Y2godHlwZW9mIHQpe2Nhc2VcIm9iamVjdFwiOnJldHVybiBlLmV4dGVuZChuLHQpLG47Y2FzZVwic3RyaW5nXCI6cmV0dXJuIG5bdF18fHQ7Y2FzZVwidW5kZWZpbmVkXCI6ZGVmYXVsdDpyZXR1cm4gbn19fSgpLGVbdF0uc3VwcG9ydD17dG91Y2g6XCJvbnRvdWNoc3RhcnRcImluIHdpbmRvd3x8bmF2aWdhdG9yLm1zTWF4VG91Y2hQb2ludHN8fCExLGNzc3RyYW5zaXRpb25zOmZ1bmN0aW9uKCl7aWYoXCJ1bmRlZmluZWRcIiE9dHlwZW9mIE1vZGVybml6ciYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIE1vZGVybml6ci5jc3N0cmFuc2l0aW9ucylyZXR1cm4gTW9kZXJuaXpyLmNzc3RyYW5zaXRpb25zO3ZhciBlPWRvY3VtZW50LmJvZHl8fGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCxuPWUuc3R5bGUsdD1cInRyYW5zaXRpb25cIjtpZihcInN0cmluZ1wiPT10eXBlb2Ygblt0XSlyZXR1cm4hMDt2YXIgaT1bXCJNb3pcIixcIndlYmtpdFwiLFwiV2Via2l0XCIsXCJLaHRtbFwiLFwiT1wiLFwibXNcIl07dD10LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpK3Quc3Vic3RyKDEpO2Zvcih2YXIgcz0wO3M8aS5sZW5ndGg7cysrKWlmKFwic3RyaW5nXCI9PXR5cGVvZiBuW2lbc10rdF0pcmV0dXJuITA7cmV0dXJuITF9KCksY3NzdHJhbnNmb3JtczpmdW5jdGlvbigpe3JldHVyblwidW5kZWZpbmVkXCI9PXR5cGVvZiBNb2Rlcm5penJ8fFwidW5kZWZpbmVkXCI9PXR5cGVvZiBNb2Rlcm5penIuY3NzdHJhbnNmb3Jtc3x8TW9kZXJuaXpyLmNzc3RyYW5zZm9ybXN9KCksY3NzdHJhbnNmb3JtczNkOmZ1bmN0aW9uKCl7cmV0dXJuXCJ1bmRlZmluZWRcIj09dHlwZW9mIE1vZGVybml6cnx8XCJ1bmRlZmluZWRcIj09dHlwZW9mIE1vZGVybml6ci5jc3N0cmFuc2Zvcm1zM2R8fE1vZGVybml6ci5jc3N0cmFuc2Zvcm1zM2R9KCl9O3ZhciBzLGEsbyxyfX0oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgb2ZmQ2FudmFzIGFkZC1vblxuICogbW1lbnUuZnJlYnNpdGUubmxcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZyZWQgSGV1c3NjaGVuXG4gKi9cbmZ1bmN0aW9uKGUpe3ZhciBuPVwibW1lbnVcIix0PVwib2ZmQ2FudmFzXCI7ZVtuXS5hZGRvbnNbdF09e3NldHVwOmZ1bmN0aW9uKCl7aWYodGhpcy5vcHRzW3RdKXt2YXIgcz10aGlzLm9wdHNbdF0sYT10aGlzLmNvbmZbdF07bz1lW25dLmdsYmwsdGhpcy5fYXBpPWUubWVyZ2UodGhpcy5fYXBpLFtcIm9wZW5cIixcImNsb3NlXCIsXCJzZXRQYWdlXCJdKSxcInRvcFwiIT1zLnBvc2l0aW9uJiZcImJvdHRvbVwiIT1zLnBvc2l0aW9ufHwocy56cG9zaXRpb249XCJmcm9udFwiKSxcInN0cmluZ1wiIT10eXBlb2YgYS5wYWdlU2VsZWN0b3ImJihhLnBhZ2VTZWxlY3Rvcj1cIj4gXCIrYS5wYWdlTm9kZXR5cGUpLG8uJGFsbE1lbnVzPShvLiRhbGxNZW51c3x8ZSgpKS5hZGQodGhpcy4kbWVudSksdGhpcy52YXJzLm9wZW5lZD0hMTt2YXIgcj1baS5vZmZjYW52YXNdO1wibGVmdFwiIT1zLnBvc2l0aW9uJiZyLnB1c2goaS5tbShzLnBvc2l0aW9uKSksXCJiYWNrXCIhPXMuenBvc2l0aW9uJiZyLnB1c2goaS5tbShzLnpwb3NpdGlvbikpLHRoaXMuJG1lbnUuYWRkQ2xhc3Moci5qb2luKFwiIFwiKSkucGFyZW50KCkucmVtb3ZlQ2xhc3MoaS53cmFwcGVyKSxlW25dLnN1cHBvcnQuY3NzdHJhbnNmb3Jtc3x8dGhpcy4kbWVudS5hZGRDbGFzcyhpW1wibm8tY3NzdHJhbnNmb3Jtc1wiXSksZVtuXS5zdXBwb3J0LmNzc3RyYW5zZm9ybXMzZHx8dGhpcy4kbWVudS5hZGRDbGFzcyhpW1wibm8tY3NzdHJhbnNmb3JtczNkXCJdKSx0aGlzLnNldFBhZ2Uoby4kcGFnZSksdGhpcy5faW5pdEJsb2NrZXIoKSx0aGlzW1wiX2luaXRXaW5kb3dfXCIrdF0oKSx0aGlzLiRtZW51W2EubWVudUluamVjdE1ldGhvZCtcIlRvXCJdKGEubWVudVdyYXBwZXJTZWxlY3Rvcik7dmFyIGw9d2luZG93LmxvY2F0aW9uLmhhc2g7aWYobCl7dmFyIGQ9dGhpcy5fZ2V0T3JpZ2luYWxNZW51SWQoKTtkJiZkPT1sLnNsaWNlKDEpJiZ0aGlzLm9wZW4oKX19fSxhZGQ6ZnVuY3Rpb24oKXtpPWVbbl0uX2Mscz1lW25dLl9kLGE9ZVtuXS5fZSxpLmFkZChcIm9mZmNhbnZhcyBzbGlkZW91dCBibG9ja2luZyBtb2RhbCBiYWNrZ3JvdW5kIG9wZW5pbmcgYmxvY2tlciBwYWdlIG5vLWNzc3RyYW5zZm9ybXMzZFwiKSxzLmFkZChcInN0eWxlXCIpLGEuYWRkKFwicmVzaXplXCIpfSxjbGlja0FuY2hvcjpmdW5jdGlvbihlLG4pe3ZhciBzPXRoaXM7aWYodGhpcy5vcHRzW3RdKXt2YXIgYT10aGlzLl9nZXRPcmlnaW5hbE1lbnVJZCgpO2lmKGEmJmUuaXMoJ1tocmVmPVwiIycrYSsnXCJdJykpe2lmKG4pcmV0dXJuITA7dmFyIHI9ZS5jbG9zZXN0KFwiLlwiK2kubWVudSk7aWYoci5sZW5ndGgpe3ZhciBsPXIuZGF0YShcIm1tZW51XCIpO2lmKGwmJmwuY2xvc2UpcmV0dXJuIGwuY2xvc2UoKSxzLl9fdHJhbnNpdGlvbmVuZChyLGZ1bmN0aW9uKCl7cy5vcGVuKCl9LHMuY29uZi50cmFuc2l0aW9uRHVyYXRpb24pLCEwfXJldHVybiB0aGlzLm9wZW4oKSwhMH1pZihvLiRwYWdlKXJldHVybiBhPW8uJHBhZ2UuZmlyc3QoKS5hdHRyKFwiaWRcIiksYSYmZS5pcygnW2hyZWY9XCIjJythKydcIl0nKT8odGhpcy5jbG9zZSgpLCEwKTp2b2lkIDB9fX0sZVtuXS5kZWZhdWx0c1t0XT17cG9zaXRpb246XCJsZWZ0XCIsenBvc2l0aW9uOlwiYmFja1wiLGJsb2NrVUk6ITAsbW92ZUJhY2tncm91bmQ6ITB9LGVbbl0uY29uZmlndXJhdGlvblt0XT17cGFnZU5vZGV0eXBlOlwiZGl2XCIscGFnZVNlbGVjdG9yOm51bGwsbm9QYWdlU2VsZWN0b3I6W10sd3JhcFBhZ2VJZk5lZWRlZDohMCxtZW51V3JhcHBlclNlbGVjdG9yOlwiYm9keVwiLG1lbnVJbmplY3RNZXRob2Q6XCJwcmVwZW5kXCJ9LGVbbl0ucHJvdG90eXBlLm9wZW49ZnVuY3Rpb24oKXtpZighdGhpcy52YXJzLm9wZW5lZCl7dmFyIGU9dGhpczt0aGlzLl9vcGVuU2V0dXAoKSxzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7ZS5fb3BlbkZpbmlzaCgpfSx0aGlzLmNvbmYub3BlbmluZ0ludGVydmFsKSx0aGlzLnRyaWdnZXIoXCJvcGVuXCIpfX0sZVtuXS5wcm90b3R5cGUuX29wZW5TZXR1cD1mdW5jdGlvbigpe3ZhciBuPXRoaXMscj10aGlzLm9wdHNbdF07dGhpcy5jbG9zZUFsbE90aGVycygpLG8uJHBhZ2UuZWFjaChmdW5jdGlvbigpe2UodGhpcykuZGF0YShzLnN0eWxlLGUodGhpcykuYXR0cihcInN0eWxlXCIpfHxcIlwiKX0pLG8uJHduZHcudHJpZ2dlcihhLnJlc2l6ZStcIi1cIit0LFshMF0pO3ZhciBsPVtpLm9wZW5lZF07ci5ibG9ja1VJJiZsLnB1c2goaS5ibG9ja2luZyksXCJtb2RhbFwiPT1yLmJsb2NrVUkmJmwucHVzaChpLm1vZGFsKSxyLm1vdmVCYWNrZ3JvdW5kJiZsLnB1c2goaS5iYWNrZ3JvdW5kKSxcImxlZnRcIiE9ci5wb3NpdGlvbiYmbC5wdXNoKGkubW0odGhpcy5vcHRzW3RdLnBvc2l0aW9uKSksXCJiYWNrXCIhPXIuenBvc2l0aW9uJiZsLnB1c2goaS5tbSh0aGlzLm9wdHNbdF0uenBvc2l0aW9uKSksdGhpcy5vcHRzLmV4dGVuc2lvbnMmJmwucHVzaCh0aGlzLm9wdHMuZXh0ZW5zaW9ucyksby4kaHRtbC5hZGRDbGFzcyhsLmpvaW4oXCIgXCIpKSxzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7bi52YXJzLm9wZW5lZD0hMH0sdGhpcy5jb25mLm9wZW5pbmdJbnRlcnZhbCksdGhpcy4kbWVudS5hZGRDbGFzcyhpLmN1cnJlbnQrXCIgXCIraS5vcGVuZWQpfSxlW25dLnByb3RvdHlwZS5fb3BlbkZpbmlzaD1mdW5jdGlvbigpe3ZhciBlPXRoaXM7dGhpcy5fX3RyYW5zaXRpb25lbmQoby4kcGFnZS5maXJzdCgpLGZ1bmN0aW9uKCl7ZS50cmlnZ2VyKFwib3BlbmVkXCIpfSx0aGlzLmNvbmYudHJhbnNpdGlvbkR1cmF0aW9uKSxvLiRodG1sLmFkZENsYXNzKGkub3BlbmluZyksdGhpcy50cmlnZ2VyKFwib3BlbmluZ1wiKX0sZVtuXS5wcm90b3R5cGUuY2xvc2U9ZnVuY3Rpb24oKXtpZih0aGlzLnZhcnMub3BlbmVkKXt2YXIgbj10aGlzO3RoaXMuX190cmFuc2l0aW9uZW5kKG8uJHBhZ2UuZmlyc3QoKSxmdW5jdGlvbigpe24uJG1lbnUucmVtb3ZlQ2xhc3MoaS5jdXJyZW50K1wiIFwiK2kub3BlbmVkKTt2YXIgYT1baS5vcGVuZWQsaS5ibG9ja2luZyxpLm1vZGFsLGkuYmFja2dyb3VuZCxpLm1tKG4ub3B0c1t0XS5wb3NpdGlvbiksaS5tbShuLm9wdHNbdF0uenBvc2l0aW9uKV07bi5vcHRzLmV4dGVuc2lvbnMmJmEucHVzaChuLm9wdHMuZXh0ZW5zaW9ucyksby4kaHRtbC5yZW1vdmVDbGFzcyhhLmpvaW4oXCIgXCIpKSxvLiRwYWdlLmVhY2goZnVuY3Rpb24oKXtlKHRoaXMpLmF0dHIoXCJzdHlsZVwiLGUodGhpcykuZGF0YShzLnN0eWxlKSl9KSxuLnZhcnMub3BlbmVkPSExLG4udHJpZ2dlcihcImNsb3NlZFwiKX0sdGhpcy5jb25mLnRyYW5zaXRpb25EdXJhdGlvbiksby4kaHRtbC5yZW1vdmVDbGFzcyhpLm9wZW5pbmcpLHRoaXMudHJpZ2dlcihcImNsb3NlXCIpLHRoaXMudHJpZ2dlcihcImNsb3NpbmdcIil9fSxlW25dLnByb3RvdHlwZS5jbG9zZUFsbE90aGVycz1mdW5jdGlvbigpe28uJGFsbE1lbnVzLm5vdCh0aGlzLiRtZW51KS5lYWNoKGZ1bmN0aW9uKCl7dmFyIHQ9ZSh0aGlzKS5kYXRhKG4pO3QmJnQuY2xvc2UmJnQuY2xvc2UoKX0pfSxlW25dLnByb3RvdHlwZS5zZXRQYWdlPWZ1bmN0aW9uKG4pe3ZhciBzPXRoaXMsYT10aGlzLmNvbmZbdF07biYmbi5sZW5ndGh8fChuPW8uJGJvZHkuZmluZChhLnBhZ2VTZWxlY3RvciksYS5ub1BhZ2VTZWxlY3Rvci5sZW5ndGgmJihuPW4ubm90KGEubm9QYWdlU2VsZWN0b3Iuam9pbihcIiwgXCIpKSksbi5sZW5ndGg+MSYmYS53cmFwUGFnZUlmTmVlZGVkJiYobj1uLndyYXBBbGwoXCI8XCIrdGhpcy5jb25mW3RdLnBhZ2VOb2RldHlwZStcIiAvPlwiKS5wYXJlbnQoKSkpLG4uZWFjaChmdW5jdGlvbigpe2UodGhpcykuYXR0cihcImlkXCIsZSh0aGlzKS5hdHRyKFwiaWRcIil8fHMuX19nZXRVbmlxdWVJZCgpKX0pLG4uYWRkQ2xhc3MoaS5wYWdlK1wiIFwiK2kuc2xpZGVvdXQpLG8uJHBhZ2U9bix0aGlzLnRyaWdnZXIoXCJzZXRQYWdlXCIsbil9LGVbbl0ucHJvdG90eXBlW1wiX2luaXRXaW5kb3dfXCIrdF09ZnVuY3Rpb24oKXtvLiR3bmR3Lm9mZihhLmtleWRvd24rXCItXCIrdCkub24oYS5rZXlkb3duK1wiLVwiK3QsZnVuY3Rpb24oZSl7aWYoby4kaHRtbC5oYXNDbGFzcyhpLm9wZW5lZCkmJjk9PWUua2V5Q29kZSlyZXR1cm4gZS5wcmV2ZW50RGVmYXVsdCgpLCExfSk7dmFyIGU9MDtvLiR3bmR3Lm9mZihhLnJlc2l6ZStcIi1cIit0KS5vbihhLnJlc2l6ZStcIi1cIit0LGZ1bmN0aW9uKG4sdCl7aWYoMT09by4kcGFnZS5sZW5ndGgmJih0fHxvLiRodG1sLmhhc0NsYXNzKGkub3BlbmVkKSkpe3ZhciBzPW8uJHduZHcuaGVpZ2h0KCk7KHR8fHMhPWUpJiYoZT1zLG8uJHBhZ2UuY3NzKFwibWluSGVpZ2h0XCIscykpfX0pfSxlW25dLnByb3RvdHlwZS5faW5pdEJsb2NrZXI9ZnVuY3Rpb24oKXt2YXIgbj10aGlzO3RoaXMub3B0c1t0XS5ibG9ja1VJJiYoby4kYmxja3x8KG8uJGJsY2s9ZSgnPGRpdiBpZD1cIicraS5ibG9ja2VyKydcIiBjbGFzcz1cIicraS5zbGlkZW91dCsnXCIgLz4nKSksby4kYmxjay5hcHBlbmRUbyhvLiRib2R5KS5vZmYoYS50b3VjaHN0YXJ0K1wiLVwiK3QrXCIgXCIrYS50b3VjaG1vdmUrXCItXCIrdCkub24oYS50b3VjaHN0YXJ0K1wiLVwiK3QrXCIgXCIrYS50b3VjaG1vdmUrXCItXCIrdCxmdW5jdGlvbihlKXtlLnByZXZlbnREZWZhdWx0KCksZS5zdG9wUHJvcGFnYXRpb24oKSxvLiRibGNrLnRyaWdnZXIoYS5tb3VzZWRvd24rXCItXCIrdCl9KS5vZmYoYS5tb3VzZWRvd24rXCItXCIrdCkub24oYS5tb3VzZWRvd24rXCItXCIrdCxmdW5jdGlvbihlKXtlLnByZXZlbnREZWZhdWx0KCksby4kaHRtbC5oYXNDbGFzcyhpLm1vZGFsKXx8KG4uY2xvc2VBbGxPdGhlcnMoKSxuLmNsb3NlKCkpfSkpfTt2YXIgaSxzLGEsb30oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgc2Nyb2xsQnVnRml4IGFkZC1vblxuICogbW1lbnUuZnJlYnNpdGUubmxcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZyZWQgSGV1c3NjaGVuXG4gKi9cbmZ1bmN0aW9uKGUpe3ZhciBuPVwibW1lbnVcIix0PVwic2Nyb2xsQnVnRml4XCI7ZVtuXS5hZGRvbnNbdF09e3NldHVwOmZ1bmN0aW9uKCl7dmFyIHM9dGhpcyxyPXRoaXMub3B0c1t0XTt0aGlzLmNvbmZbdF07aWYobz1lW25dLmdsYmwsZVtuXS5zdXBwb3J0LnRvdWNoJiZ0aGlzLm9wdHMub2ZmQ2FudmFzJiZ0aGlzLm9wdHMub2ZmQ2FudmFzLmJsb2NrVUkmJihcImJvb2xlYW5cIj09dHlwZW9mIHImJihyPXtmaXg6cn0pLFwib2JqZWN0XCIhPXR5cGVvZiByJiYocj17fSkscj10aGlzLm9wdHNbdF09ZS5leHRlbmQoITAse30sZVtuXS5kZWZhdWx0c1t0XSxyKSxyLmZpeCkpe3ZhciBsPXRoaXMuJG1lbnUuYXR0cihcImlkXCIpLGQ9ITE7dGhpcy5iaW5kKFwib3BlbmluZ1wiLGZ1bmN0aW9uKCl7dGhpcy4kcG5scy5jaGlsZHJlbihcIi5cIitpLmN1cnJlbnQpLnNjcm9sbFRvcCgwKX0pLG8uJGRvY3Uub24oYS50b3VjaG1vdmUsZnVuY3Rpb24oZSl7cy52YXJzLm9wZW5lZCYmZS5wcmV2ZW50RGVmYXVsdCgpfSksby4kYm9keS5vbihhLnRvdWNoc3RhcnQsXCIjXCIrbCtcIj4gLlwiK2kucGFuZWxzK1wiPiAuXCIraS5jdXJyZW50LGZ1bmN0aW9uKGUpe3MudmFycy5vcGVuZWQmJihkfHwoZD0hMCwwPT09ZS5jdXJyZW50VGFyZ2V0LnNjcm9sbFRvcD9lLmN1cnJlbnRUYXJnZXQuc2Nyb2xsVG9wPTE6ZS5jdXJyZW50VGFyZ2V0LnNjcm9sbEhlaWdodD09PWUuY3VycmVudFRhcmdldC5zY3JvbGxUb3ArZS5jdXJyZW50VGFyZ2V0Lm9mZnNldEhlaWdodCYmKGUuY3VycmVudFRhcmdldC5zY3JvbGxUb3AtPTEpLGQ9ITEpKX0pLm9uKGEudG91Y2htb3ZlLFwiI1wiK2wrXCI+IC5cIitpLnBhbmVscytcIj4gLlwiK2kuY3VycmVudCxmdW5jdGlvbihuKXtzLnZhcnMub3BlbmVkJiZlKHRoaXMpWzBdLnNjcm9sbEhlaWdodD5lKHRoaXMpLmlubmVySGVpZ2h0KCkmJm4uc3RvcFByb3BhZ2F0aW9uKCl9KSxvLiR3bmR3Lm9uKGEub3JpZW50YXRpb25jaGFuZ2UsZnVuY3Rpb24oKXtzLiRwbmxzLmNoaWxkcmVuKFwiLlwiK2kuY3VycmVudCkuc2Nyb2xsVG9wKDApLmNzcyh7XCItd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZ1wiOlwiYXV0b1wifSkuY3NzKHtcIi13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nXCI6XCJ0b3VjaFwifSl9KX19LGFkZDpmdW5jdGlvbigpe2k9ZVtuXS5fYyxzPWVbbl0uX2QsYT1lW25dLl9lfSxjbGlja0FuY2hvcjpmdW5jdGlvbihlLG4pe319LGVbbl0uZGVmYXVsdHNbdF09e2ZpeDohMH07dmFyIGkscyxhLG99KGpRdWVyeSksLypcdFxuICogalF1ZXJ5IG1tZW51IGF1dG9IZWlnaHQgYWRkLW9uXG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7dmFyIG49XCJtbWVudVwiLHQ9XCJhdXRvSGVpZ2h0XCI7ZVtuXS5hZGRvbnNbdF09e3NldHVwOmZ1bmN0aW9uKCl7aWYodGhpcy5vcHRzLm9mZkNhbnZhcyl7dmFyIHM9dGhpcy5vcHRzW3RdO3RoaXMuY29uZlt0XTtpZihvPWVbbl0uZ2xibCxcImJvb2xlYW5cIj09dHlwZW9mIHMmJnMmJihzPXtoZWlnaHQ6XCJhdXRvXCJ9KSxcInN0cmluZ1wiPT10eXBlb2YgcyYmKHM9e2hlaWdodDpzfSksXCJvYmplY3RcIiE9dHlwZW9mIHMmJihzPXt9KSxzPXRoaXMub3B0c1t0XT1lLmV4dGVuZCghMCx7fSxlW25dLmRlZmF1bHRzW3RdLHMpLFwiYXV0b1wiPT1zLmhlaWdodHx8XCJoaWdoZXN0XCI9PXMuaGVpZ2h0KXt0aGlzLiRtZW51LmFkZENsYXNzKGkuYXV0b2hlaWdodCk7dmFyIGE9ZnVuY3Rpb24obil7aWYodGhpcy52YXJzLm9wZW5lZCl7dmFyIHQ9cGFyc2VJbnQodGhpcy4kcG5scy5jc3MoXCJ0b3BcIiksMTApfHwwLGE9cGFyc2VJbnQodGhpcy4kcG5scy5jc3MoXCJib3R0b21cIiksMTApfHwwLG89MDt0aGlzLiRtZW51LmFkZENsYXNzKGkubWVhc3VyZWhlaWdodCksXCJhdXRvXCI9PXMuaGVpZ2h0PyhuPW58fHRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIraS5jdXJyZW50KSxuLmlzKFwiLlwiK2kudmVydGljYWwpJiYobj1uLnBhcmVudHMoXCIuXCIraS5wYW5lbCkubm90KFwiLlwiK2kudmVydGljYWwpLmZpcnN0KCkpLG89bi5vdXRlckhlaWdodCgpKTpcImhpZ2hlc3RcIj09cy5oZWlnaHQmJnRoaXMuJHBubHMuY2hpbGRyZW4oKS5lYWNoKGZ1bmN0aW9uKCl7dmFyIG49ZSh0aGlzKTtuLmlzKFwiLlwiK2kudmVydGljYWwpJiYobj1uLnBhcmVudHMoXCIuXCIraS5wYW5lbCkubm90KFwiLlwiK2kudmVydGljYWwpLmZpcnN0KCkpLG89TWF0aC5tYXgobyxuLm91dGVySGVpZ2h0KCkpfSksdGhpcy4kbWVudS5oZWlnaHQobyt0K2EpLnJlbW92ZUNsYXNzKGkubWVhc3VyZWhlaWdodCl9fTt0aGlzLmJpbmQoXCJvcGVuaW5nXCIsYSksXCJoaWdoZXN0XCI9PXMuaGVpZ2h0JiZ0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIsYSksXCJhdXRvXCI9PXMuaGVpZ2h0JiYodGhpcy5iaW5kKFwidXBkYXRlXCIsYSksdGhpcy5iaW5kKFwib3BlblBhbmVsXCIsYSksdGhpcy5iaW5kKFwiY2xvc2VQYW5lbFwiLGEpKX19fSxhZGQ6ZnVuY3Rpb24oKXtpPWVbbl0uX2Mscz1lW25dLl9kLGE9ZVtuXS5fZSxpLmFkZChcImF1dG9oZWlnaHQgbWVhc3VyZWhlaWdodFwiKSxhLmFkZChcInJlc2l6ZVwiKX0sY2xpY2tBbmNob3I6ZnVuY3Rpb24oZSxuKXt9fSxlW25dLmRlZmF1bHRzW3RdPXtoZWlnaHQ6XCJkZWZhdWx0XCJ9O3ZhciBpLHMsYSxvfShqUXVlcnkpLC8qXHRcbiAqIGpRdWVyeSBtbWVudSBiYWNrQnV0dG9uIGFkZC1vblxuICogbW1lbnUuZnJlYnNpdGUubmxcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZyZWQgSGV1c3NjaGVuXG4gKi9cbmZ1bmN0aW9uKGUpe3ZhciBuPVwibW1lbnVcIix0PVwiYmFja0J1dHRvblwiO2Vbbl0uYWRkb25zW3RdPXtzZXR1cDpmdW5jdGlvbigpe2lmKHRoaXMub3B0cy5vZmZDYW52YXMpe3ZhciBzPXRoaXMsYT10aGlzLm9wdHNbdF07dGhpcy5jb25mW3RdO2lmKG89ZVtuXS5nbGJsLFwiYm9vbGVhblwiPT10eXBlb2YgYSYmKGE9e2Nsb3NlOmF9KSxcIm9iamVjdFwiIT10eXBlb2YgYSYmKGE9e30pLGE9ZS5leHRlbmQoITAse30sZVtuXS5kZWZhdWx0c1t0XSxhKSxhLmNsb3NlKXt2YXIgcj1cIiNcIitzLiRtZW51LmF0dHIoXCJpZFwiKTt0aGlzLmJpbmQoXCJvcGVuZWRcIixmdW5jdGlvbihlKXtsb2NhdGlvbi5oYXNoIT1yJiZoaXN0b3J5LnB1c2hTdGF0ZShudWxsLGRvY3VtZW50LnRpdGxlLHIpfSksZSh3aW5kb3cpLm9uKFwicG9wc3RhdGVcIixmdW5jdGlvbihlKXtvLiRodG1sLmhhc0NsYXNzKGkub3BlbmVkKT8oZS5zdG9wUHJvcGFnYXRpb24oKSxzLmNsb3NlKCkpOmxvY2F0aW9uLmhhc2g9PXImJihlLnN0b3BQcm9wYWdhdGlvbigpLHMub3BlbigpKX0pfX19LGFkZDpmdW5jdGlvbigpe3JldHVybiB3aW5kb3cuaGlzdG9yeSYmd2luZG93Lmhpc3RvcnkucHVzaFN0YXRlPyhpPWVbbl0uX2Mscz1lW25dLl9kLHZvaWQoYT1lW25dLl9lKSk6dm9pZChlW25dLmFkZG9uc1t0XS5zZXR1cD1mdW5jdGlvbigpe30pfSxjbGlja0FuY2hvcjpmdW5jdGlvbihlLG4pe319LGVbbl0uZGVmYXVsdHNbdF09e2Nsb3NlOiExfTt2YXIgaSxzLGEsb30oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgY29sdW1ucyBhZGQtb25cbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlxuICogQ29weXJpZ2h0IChjKSBGcmVkIEhldXNzY2hlblxuICovXG5mdW5jdGlvbihlKXt2YXIgbj1cIm1tZW51XCIsdD1cImNvbHVtbnNcIjtlW25dLmFkZG9uc1t0XT17c2V0dXA6ZnVuY3Rpb24oKXt2YXIgcz10aGlzLm9wdHNbdF07dGhpcy5jb25mW3RdO2lmKG89ZVtuXS5nbGJsLFwiYm9vbGVhblwiPT10eXBlb2YgcyYmKHM9e2FkZDpzfSksXCJudW1iZXJcIj09dHlwZW9mIHMmJihzPXthZGQ6ITAsdmlzaWJsZTpzfSksXCJvYmplY3RcIiE9dHlwZW9mIHMmJihzPXt9KSxcIm51bWJlclwiPT10eXBlb2Ygcy52aXNpYmxlJiYocy52aXNpYmxlPXttaW46cy52aXNpYmxlLG1heDpzLnZpc2libGV9KSxzPXRoaXMub3B0c1t0XT1lLmV4dGVuZCghMCx7fSxlW25dLmRlZmF1bHRzW3RdLHMpLHMuYWRkKXtzLnZpc2libGUubWluPU1hdGgubWF4KDEsTWF0aC5taW4oNixzLnZpc2libGUubWluKSkscy52aXNpYmxlLm1heD1NYXRoLm1heChzLnZpc2libGUubWluLE1hdGgubWluKDYscy52aXNpYmxlLm1heCkpLHRoaXMuJG1lbnUuYWRkQ2xhc3MoaS5jb2x1bW5zKTtmb3IodmFyIGE9dGhpcy5vcHRzLm9mZkNhbnZhcz90aGlzLiRtZW51LmFkZChvLiRodG1sKTp0aGlzLiRtZW51LHI9W10sbD0wO2w8PXMudmlzaWJsZS5tYXg7bCsrKXIucHVzaChpLmNvbHVtbnMrXCItXCIrbCk7cj1yLmpvaW4oXCIgXCIpO3ZhciBkPWZ1bmN0aW9uKGUpe3UuY2FsbCh0aGlzLHRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIraS5jdXJyZW50KSl9LGM9ZnVuY3Rpb24oKXt2YXIgZT10aGlzLiRwbmxzLmNoaWxkcmVuKFwiLlwiK2kucGFuZWwpLmZpbHRlcihcIi5cIitpLm9wZW5lZCkubGVuZ3RoO2U9TWF0aC5taW4ocy52aXNpYmxlLm1heCxNYXRoLm1heChzLnZpc2libGUubWluLGUpKSxhLnJlbW92ZUNsYXNzKHIpLmFkZENsYXNzKGkuY29sdW1ucytcIi1cIitlKX0saD1mdW5jdGlvbigpe3RoaXMub3B0cy5vZmZDYW52YXMmJm8uJGh0bWwucmVtb3ZlQ2xhc3Mocil9LHU9ZnVuY3Rpb24obil7dGhpcy4kcG5scy5jaGlsZHJlbihcIi5cIitpLnBhbmVsKS5yZW1vdmVDbGFzcyhyKS5maWx0ZXIoXCIuXCIraS5zdWJvcGVuZWQpLnJlbW92ZUNsYXNzKGkuaGlkZGVuKS5hZGQobikuc2xpY2UoLXMudmlzaWJsZS5tYXgpLmVhY2goZnVuY3Rpb24obil7ZSh0aGlzKS5hZGRDbGFzcyhpLmNvbHVtbnMrXCItXCIrbil9KX07dGhpcy5iaW5kKFwib3BlblwiLGMpLHRoaXMuYmluZChcImNsb3NlXCIsaCksdGhpcy5iaW5kKFwiaW5pdFBhbmVsc1wiLGQpLHRoaXMuYmluZChcIm9wZW5QYW5lbFwiLHUpLHRoaXMuYmluZChcIm9wZW5pbmdQYW5lbFwiLGMpLHRoaXMuYmluZChcIm9wZW5lZFBhbmVsXCIsYyksdGhpcy5vcHRzLm9mZkNhbnZhc3x8Yy5jYWxsKHRoaXMpfX0sYWRkOmZ1bmN0aW9uKCl7aT1lW25dLl9jLHM9ZVtuXS5fZCxhPWVbbl0uX2UsaS5hZGQoXCJjb2x1bW5zXCIpfSxjbGlja0FuY2hvcjpmdW5jdGlvbihuLHMpe2lmKCF0aGlzLm9wdHNbdF0uYWRkKXJldHVybiExO2lmKHMpe3ZhciBhPW4uYXR0cihcImhyZWZcIik7aWYoYS5sZW5ndGg+MSYmXCIjXCI9PWEuc2xpY2UoMCwxKSl0cnl7dmFyIG89ZShhLHRoaXMuJG1lbnUpO2lmKG8uaXMoXCIuXCIraS5wYW5lbCkpZm9yKHZhciByPXBhcnNlSW50KG4uY2xvc2VzdChcIi5cIitpLnBhbmVsKS5hdHRyKFwiY2xhc3NcIikuc3BsaXQoaS5jb2x1bW5zK1wiLVwiKVsxXS5zcGxpdChcIiBcIilbMF0sMTApKzE7ciE9PSExOyl7dmFyIGw9dGhpcy4kcG5scy5jaGlsZHJlbihcIi5cIitpLmNvbHVtbnMrXCItXCIrcik7aWYoIWwubGVuZ3RoKXtyPSExO2JyZWFrfXIrKyxsLnJlbW92ZUNsYXNzKGkuc3Vib3BlbmVkKS5yZW1vdmVDbGFzcyhpLm9wZW5lZCkucmVtb3ZlQ2xhc3MoaS5jdXJyZW50KS5yZW1vdmVDbGFzcyhpLmhpZ2hlc3QpLmFkZENsYXNzKGkuaGlkZGVuKX19Y2F0Y2goZCl7fX19fSxlW25dLmRlZmF1bHRzW3RdPXthZGQ6ITEsdmlzaWJsZTp7bWluOjEsbWF4OjN9fTt2YXIgaSxzLGEsb30oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgY291bnRlcnMgYWRkLW9uXG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7dmFyIG49XCJtbWVudVwiLHQ9XCJjb3VudGVyc1wiO2Vbbl0uYWRkb25zW3RdPXtzZXR1cDpmdW5jdGlvbigpe3ZhciBhPXRoaXMscj10aGlzLm9wdHNbdF07dGhpcy5jb25mW3RdO289ZVtuXS5nbGJsLFwiYm9vbGVhblwiPT10eXBlb2YgciYmKHI9e2FkZDpyLHVwZGF0ZTpyfSksXCJvYmplY3RcIiE9dHlwZW9mIHImJihyPXt9KSxyPXRoaXMub3B0c1t0XT1lLmV4dGVuZCghMCx7fSxlW25dLmRlZmF1bHRzW3RdLHIpLHRoaXMuYmluZChcImluaXRQYW5lbHNcIixmdW5jdGlvbihuKXt0aGlzLl9fcmVmYWN0b3JDbGFzcyhlKFwiZW1cIixuKSx0aGlzLmNvbmYuY2xhc3NOYW1lc1t0XS5jb3VudGVyLFwiY291bnRlclwiKX0pLHIuYWRkJiZ0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIsZnVuY3Rpb24obil7dmFyIHQ7c3dpdGNoKHIuYWRkVG8pe2Nhc2VcInBhbmVsc1wiOnQ9bjticmVhaztkZWZhdWx0OnQ9bi5maWx0ZXIoci5hZGRUbyl9dC5lYWNoKGZ1bmN0aW9uKCl7dmFyIG49ZSh0aGlzKS5kYXRhKHMucGFyZW50KTtuJiYobi5jaGlsZHJlbihcImVtLlwiK2kuY291bnRlcikubGVuZ3RofHxuLnByZXBlbmQoZSgnPGVtIGNsYXNzPVwiJytpLmNvdW50ZXIrJ1wiIC8+JykpKX0pfSksci51cGRhdGUmJnRoaXMuYmluZChcInVwZGF0ZVwiLGZ1bmN0aW9uKCl7dGhpcy4kcG5scy5maW5kKFwiLlwiK2kucGFuZWwpLmVhY2goZnVuY3Rpb24oKXt2YXIgbj1lKHRoaXMpLHQ9bi5kYXRhKHMucGFyZW50KTtpZih0KXt2YXIgbz10LmNoaWxkcmVuKFwiZW0uXCIraS5jb3VudGVyKTtvLmxlbmd0aCYmKG49bi5jaGlsZHJlbihcIi5cIitpLmxpc3R2aWV3KSxuLmxlbmd0aCYmby5odG1sKGEuX19maWx0ZXJMaXN0SXRlbXMobi5jaGlsZHJlbigpKS5sZW5ndGgpKX19KX0pfSxhZGQ6ZnVuY3Rpb24oKXtpPWVbbl0uX2Mscz1lW25dLl9kLGE9ZVtuXS5fZSxpLmFkZChcImNvdW50ZXIgc2VhcmNoIG5vcmVzdWx0c21zZ1wiKX0sY2xpY2tBbmNob3I6ZnVuY3Rpb24oZSxuKXt9fSxlW25dLmRlZmF1bHRzW3RdPXthZGQ6ITEsYWRkVG86XCJwYW5lbHNcIix1cGRhdGU6ITF9LGVbbl0uY29uZmlndXJhdGlvbi5jbGFzc05hbWVzW3RdPXtjb3VudGVyOlwiQ291bnRlclwifTt2YXIgaSxzLGEsb30oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgZGl2aWRlcnMgYWRkLW9uXG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7dmFyIG49XCJtbWVudVwiLHQ9XCJkaXZpZGVyc1wiO2Vbbl0uYWRkb25zW3RdPXtzZXR1cDpmdW5jdGlvbigpe3ZhciBzPXRoaXMscj10aGlzLm9wdHNbdF07dGhpcy5jb25mW3RdO2lmKG89ZVtuXS5nbGJsLFwiYm9vbGVhblwiPT10eXBlb2YgciYmKHI9e2FkZDpyLGZpeGVkOnJ9KSxcIm9iamVjdFwiIT10eXBlb2YgciYmKHI9e30pLHI9dGhpcy5vcHRzW3RdPWUuZXh0ZW5kKCEwLHt9LGVbbl0uZGVmYXVsdHNbdF0sciksdGhpcy5iaW5kKFwiaW5pdFBhbmVsc1wiLGZ1bmN0aW9uKG4pe3RoaXMuX19yZWZhY3RvckNsYXNzKGUoXCJsaVwiLHRoaXMuJG1lbnUpLHRoaXMuY29uZi5jbGFzc05hbWVzW3RdLmNvbGxhcHNlZCxcImNvbGxhcHNlZFwiKX0pLHIuYWRkJiZ0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIsZnVuY3Rpb24obil7dmFyIHQ7c3dpdGNoKHIuYWRkVG8pe2Nhc2VcInBhbmVsc1wiOnQ9bjticmVhaztkZWZhdWx0OnQ9bi5maWx0ZXIoci5hZGRUbyl9ZShcIi5cIitpLmRpdmlkZXIsdCkucmVtb3ZlKCksdC5maW5kKFwiLlwiK2kubGlzdHZpZXcpLm5vdChcIi5cIitpLnZlcnRpY2FsKS5lYWNoKGZ1bmN0aW9uKCl7dmFyIG49XCJcIjtzLl9fZmlsdGVyTGlzdEl0ZW1zKGUodGhpcykuY2hpbGRyZW4oKSkuZWFjaChmdW5jdGlvbigpe3ZhciB0PWUudHJpbShlKHRoaXMpLmNoaWxkcmVuKFwiYSwgc3BhblwiKS50ZXh0KCkpLnNsaWNlKDAsMSkudG9Mb3dlckNhc2UoKTt0IT1uJiZ0Lmxlbmd0aCYmKG49dCxlKCc8bGkgY2xhc3M9XCInK2kuZGl2aWRlcisnXCI+Jyt0K1wiPC9saT5cIikuaW5zZXJ0QmVmb3JlKHRoaXMpKX0pfSl9KSxyLmNvbGxhcHNlJiZ0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIsZnVuY3Rpb24obil7ZShcIi5cIitpLmRpdmlkZXIsbikuZWFjaChmdW5jdGlvbigpe3ZhciBuPWUodGhpcyksdD1uLm5leHRVbnRpbChcIi5cIitpLmRpdmlkZXIsXCIuXCIraS5jb2xsYXBzZWQpO3QubGVuZ3RoJiYobi5jaGlsZHJlbihcIi5cIitpLnN1Ym9wZW4pLmxlbmd0aHx8KG4ud3JhcElubmVyKFwiPHNwYW4gLz5cIiksbi5wcmVwZW5kKCc8YSBocmVmPVwiI1wiIGNsYXNzPVwiJytpLnN1Ym9wZW4rXCIgXCIraS5mdWxsc3Vib3BlbisnXCIgLz4nKSkpfSl9KSxyLmZpeGVkKXt2YXIgbD1mdW5jdGlvbihuKXtuPW58fHRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIraS5jdXJyZW50KTt2YXIgdD1uLmZpbmQoXCIuXCIraS5kaXZpZGVyKS5ub3QoXCIuXCIraS5oaWRkZW4pO2lmKHQubGVuZ3RoKXt0aGlzLiRtZW51LmFkZENsYXNzKGkuaGFzZGl2aWRlcnMpO3ZhciBzPW4uc2Nyb2xsVG9wKCl8fDAsYT1cIlwiO24uaXMoXCI6dmlzaWJsZVwiKSYmbi5maW5kKFwiLlwiK2kuZGl2aWRlcikubm90KFwiLlwiK2kuaGlkZGVuKS5lYWNoKGZ1bmN0aW9uKCl7ZSh0aGlzKS5wb3NpdGlvbigpLnRvcCtzPHMrMSYmKGE9ZSh0aGlzKS50ZXh0KCkpfSksdGhpcy4kZml4ZWRkaXZpZGVyLnRleHQoYSl9ZWxzZSB0aGlzLiRtZW51LnJlbW92ZUNsYXNzKGkuaGFzZGl2aWRlcnMpfTt0aGlzLiRmaXhlZGRpdmlkZXI9ZSgnPHVsIGNsYXNzPVwiJytpLmxpc3R2aWV3K1wiIFwiK2kuZml4ZWRkaXZpZGVyKydcIj48bGkgY2xhc3M9XCInK2kuZGl2aWRlcisnXCI+PC9saT48L3VsPicpLnByZXBlbmRUbyh0aGlzLiRwbmxzKS5jaGlsZHJlbigpLHRoaXMuYmluZChcIm9wZW5QYW5lbFwiLGwpLHRoaXMuYmluZChcInVwZGF0ZVwiLGwpLHRoaXMuYmluZChcImluaXRQYW5lbHNcIixmdW5jdGlvbihuKXtuLm9mZihhLnNjcm9sbCtcIi1kaXZpZGVycyBcIithLnRvdWNobW92ZStcIi1kaXZpZGVyc1wiKS5vbihhLnNjcm9sbCtcIi1kaXZpZGVycyBcIithLnRvdWNobW92ZStcIi1kaXZpZGVyc1wiLGZ1bmN0aW9uKG4pe2wuY2FsbChzLGUodGhpcykpfSl9KX19LGFkZDpmdW5jdGlvbigpe2k9ZVtuXS5fYyxzPWVbbl0uX2QsYT1lW25dLl9lLGkuYWRkKFwiY29sbGFwc2VkIHVuY29sbGFwc2VkIGZpeGVkZGl2aWRlciBoYXNkaXZpZGVyc1wiKSxhLmFkZChcInNjcm9sbFwiKX0sY2xpY2tBbmNob3I6ZnVuY3Rpb24oZSxuKXtpZih0aGlzLm9wdHNbdF0uY29sbGFwc2UmJm4pe3ZhciBzPWUucGFyZW50KCk7aWYocy5pcyhcIi5cIitpLmRpdmlkZXIpKXt2YXIgYT1zLm5leHRVbnRpbChcIi5cIitpLmRpdmlkZXIsXCIuXCIraS5jb2xsYXBzZWQpO3JldHVybiBzLnRvZ2dsZUNsYXNzKGkub3BlbmVkKSxhW3MuaGFzQ2xhc3MoaS5vcGVuZWQpP1wiYWRkQ2xhc3NcIjpcInJlbW92ZUNsYXNzXCJdKGkudW5jb2xsYXBzZWQpLCEwfX1yZXR1cm4hMX19LGVbbl0uZGVmYXVsdHNbdF09e2FkZDohMSxhZGRUbzpcInBhbmVsc1wiLGZpeGVkOiExLGNvbGxhcHNlOiExfSxlW25dLmNvbmZpZ3VyYXRpb24uY2xhc3NOYW1lc1t0XT17Y29sbGFwc2VkOlwiQ29sbGFwc2VkXCJ9O3ZhciBpLHMsYSxvfShqUXVlcnkpLC8qXHRcbiAqIGpRdWVyeSBtbWVudSBkcmFnIGFkZC1vblxuICogbW1lbnUuZnJlYnNpdGUubmxcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZyZWQgSGV1c3NjaGVuXG4gKi9cbmZ1bmN0aW9uKGUpe2Z1bmN0aW9uIG4oZSxuLHQpe3JldHVybiBlPG4mJihlPW4pLGU+dCYmKGU9dCksZX1mdW5jdGlvbiB0KHQsaSxzKXt2YXIgcixsLGQsYyxoLHU9dGhpcyxmPXt9LHA9MCx2PSExLG09ITEsZz0wLGI9MDtzd2l0Y2godGhpcy5vcHRzLm9mZkNhbnZhcy5wb3NpdGlvbil7Y2FzZVwibGVmdFwiOmNhc2VcInJpZ2h0XCI6Zi5ldmVudHM9XCJwYW5sZWZ0IHBhbnJpZ2h0XCIsZi50eXBlTG93ZXI9XCJ4XCIsZi50eXBlVXBwZXI9XCJYXCIsbT1cIndpZHRoXCI7YnJlYWs7Y2FzZVwidG9wXCI6Y2FzZVwiYm90dG9tXCI6Zi5ldmVudHM9XCJwYW51cCBwYW5kb3duXCIsZi50eXBlTG93ZXI9XCJ5XCIsZi50eXBlVXBwZXI9XCJZXCIsbT1cImhlaWdodFwifXN3aXRjaCh0aGlzLm9wdHMub2ZmQ2FudmFzLnBvc2l0aW9uKXtjYXNlXCJyaWdodFwiOmNhc2VcImJvdHRvbVwiOmYubmVnYXRpdmU9ITAsYz1mdW5jdGlvbihlKXtlPj1zLiR3bmR3W21dKCktdC5tYXhTdGFydFBvcyYmKHA9MSl9O2JyZWFrO2RlZmF1bHQ6Zi5uZWdhdGl2ZT0hMSxjPWZ1bmN0aW9uKGUpe2U8PXQubWF4U3RhcnRQb3MmJihwPTEpfX1zd2l0Y2godGhpcy5vcHRzLm9mZkNhbnZhcy5wb3NpdGlvbil7Y2FzZVwibGVmdFwiOmYub3Blbl9kaXI9XCJyaWdodFwiLGYuY2xvc2VfZGlyPVwibGVmdFwiO2JyZWFrO2Nhc2VcInJpZ2h0XCI6Zi5vcGVuX2Rpcj1cImxlZnRcIixmLmNsb3NlX2Rpcj1cInJpZ2h0XCI7YnJlYWs7Y2FzZVwidG9wXCI6Zi5vcGVuX2Rpcj1cImRvd25cIixmLmNsb3NlX2Rpcj1cInVwXCI7YnJlYWs7Y2FzZVwiYm90dG9tXCI6Zi5vcGVuX2Rpcj1cInVwXCIsZi5jbG9zZV9kaXI9XCJkb3duXCJ9c3dpdGNoKHRoaXMub3B0cy5vZmZDYW52YXMuenBvc2l0aW9uKXtjYXNlXCJmcm9udFwiOmg9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy4kbWVudX07YnJlYWs7ZGVmYXVsdDpoPWZ1bmN0aW9uKCl7cmV0dXJuIGUoXCIuXCIrby5zbGlkZW91dCl9fXZhciBfPXRoaXMuX192YWx1ZU9yRm4odC5ub2RlLHRoaXMuJG1lbnUscy4kcGFnZSk7XCJzdHJpbmdcIj09dHlwZW9mIF8mJihfPWUoXykpO3ZhciBDPW5ldyBIYW1tZXIoX1swXSx0aGlzLm9wdHNbYV0udmVuZG9ycy5oYW1tZXIpO0Mub24oXCJwYW5zdGFydFwiLGZ1bmN0aW9uKGUpe2MoZS5jZW50ZXJbZi50eXBlTG93ZXJdKSxzLiRzbGlkZU91dE5vZGVzPWgoKSx2PWYub3Blbl9kaXJ9KS5vbihmLmV2ZW50cytcIiBwYW5lbmRcIixmdW5jdGlvbihlKXtwPjAmJmUucHJldmVudERlZmF1bHQoKX0pLm9uKGYuZXZlbnRzLGZ1bmN0aW9uKGUpe2lmKHI9ZVtcImRlbHRhXCIrZi50eXBlVXBwZXJdLGYubmVnYXRpdmUmJihyPS1yKSxyIT1nJiYodj1yPj1nP2Yub3Blbl9kaXI6Zi5jbG9zZV9kaXIpLGc9cixnPnQudGhyZXNob2xkJiYxPT1wKXtpZihzLiRodG1sLmhhc0NsYXNzKG8ub3BlbmVkKSlyZXR1cm47cD0yLHUuX29wZW5TZXR1cCgpLHUudHJpZ2dlcihcIm9wZW5pbmdcIikscy4kaHRtbC5hZGRDbGFzcyhvLmRyYWdnaW5nKSxiPW4ocy4kd25kd1ttXSgpKmlbbV0ucGVyYyxpW21dLm1pbixpW21dLm1heCl9Mj09cCYmKGw9bihnLDEwLGIpLShcImZyb250XCI9PXUub3B0cy5vZmZDYW52YXMuenBvc2l0aW9uP2I6MCksZi5uZWdhdGl2ZSYmKGw9LWwpLGQ9XCJ0cmFuc2xhdGVcIitmLnR5cGVVcHBlcitcIihcIitsK1wicHggKVwiLHMuJHNsaWRlT3V0Tm9kZXMuY3NzKHtcIi13ZWJraXQtdHJhbnNmb3JtXCI6XCItd2Via2l0LVwiK2QsdHJhbnNmb3JtOmR9KSl9KS5vbihcInBhbmVuZFwiLGZ1bmN0aW9uKGUpezI9PXAmJihzLiRodG1sLnJlbW92ZUNsYXNzKG8uZHJhZ2dpbmcpLHMuJHNsaWRlT3V0Tm9kZXMuY3NzKFwidHJhbnNmb3JtXCIsXCJcIiksdVt2PT1mLm9wZW5fZGlyP1wiX29wZW5GaW5pc2hcIjpcImNsb3NlXCJdKCkpLHA9MH0pfWZ1bmN0aW9uIGkobix0LGkscyl7dmFyIGw9dGhpcztuLmVhY2goZnVuY3Rpb24oKXt2YXIgbj1lKHRoaXMpLHQ9bi5kYXRhKHIucGFyZW50KTtpZih0JiYodD10LmNsb3Nlc3QoXCIuXCIrby5wYW5lbCksdC5sZW5ndGgpKXt2YXIgaT1uZXcgSGFtbWVyKG5bMF0sbC5vcHRzW2FdLnZlbmRvcnMuaGFtbWVyKTtpLm9uKFwicGFucmlnaHRcIixmdW5jdGlvbihlKXtsLm9wZW5QYW5lbCh0KX0pfX0pfXZhciBzPVwibW1lbnVcIixhPVwiZHJhZ1wiO2Vbc10uYWRkb25zW2FdPXtzZXR1cDpmdW5jdGlvbigpe2lmKHRoaXMub3B0cy5vZmZDYW52YXMpe3ZhciBuPXRoaXMub3B0c1thXSxvPXRoaXMuY29uZlthXTtkPWVbc10uZ2xibCxcImJvb2xlYW5cIj09dHlwZW9mIG4mJihuPXttZW51Om4scGFuZWxzOm59KSxcIm9iamVjdFwiIT10eXBlb2YgbiYmKG49e30pLFwiYm9vbGVhblwiPT10eXBlb2Ygbi5tZW51JiYobi5tZW51PXtvcGVuOm4ubWVudX0pLFwib2JqZWN0XCIhPXR5cGVvZiBuLm1lbnUmJihuLm1lbnU9e30pLFwiYm9vbGVhblwiPT10eXBlb2Ygbi5wYW5lbHMmJihuLnBhbmVscz17Y2xvc2U6bi5wYW5lbHN9KSxcIm9iamVjdFwiIT10eXBlb2Ygbi5wYW5lbHMmJihuLnBhbmVscz17fSksbj10aGlzLm9wdHNbYV09ZS5leHRlbmQoITAse30sZVtzXS5kZWZhdWx0c1thXSxuKSxuLm1lbnUub3BlbiYmdC5jYWxsKHRoaXMsbi5tZW51LG8ubWVudSxkKSxuLnBhbmVscy5jbG9zZSYmdGhpcy5iaW5kKFwiaW5pdFBhbmVsc1wiLGZ1bmN0aW9uKGUpe2kuY2FsbCh0aGlzLGUsbi5wYW5lbHMsby5wYW5lbHMsZCl9KX19LGFkZDpmdW5jdGlvbigpe3JldHVyblwiZnVuY3Rpb25cIiE9dHlwZW9mIEhhbW1lcnx8SGFtbWVyLlZFUlNJT048Mj92b2lkKGVbc10uYWRkb25zW2FdLnNldHVwPWZ1bmN0aW9uKCl7fSk6KG89ZVtzXS5fYyxyPWVbc10uX2QsbD1lW3NdLl9lLHZvaWQgby5hZGQoXCJkcmFnZ2luZ1wiKSl9LGNsaWNrQW5jaG9yOmZ1bmN0aW9uKGUsbil7fX0sZVtzXS5kZWZhdWx0c1thXT17bWVudTp7b3BlbjohMSxtYXhTdGFydFBvczoxMDAsdGhyZXNob2xkOjUwfSxwYW5lbHM6e2Nsb3NlOiExfSx2ZW5kb3JzOntoYW1tZXI6e319fSxlW3NdLmNvbmZpZ3VyYXRpb25bYV09e21lbnU6e3dpZHRoOntwZXJjOi44LG1pbjoxNDAsbWF4OjQ0MH0saGVpZ2h0OntwZXJjOi44LG1pbjoxNDAsbWF4Ojg4MH19LHBhbmVsczp7fX07dmFyIG8scixsLGR9KGpRdWVyeSksLypcdFxuICogalF1ZXJ5IG1tZW51IGZpeGVkRWxlbWVudHMgYWRkLW9uXG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7dmFyIG49XCJtbWVudVwiLHQ9XCJmaXhlZEVsZW1lbnRzXCI7ZVtuXS5hZGRvbnNbdF09e3NldHVwOmZ1bmN0aW9uKCl7aWYodGhpcy5vcHRzLm9mZkNhbnZhcyl7dmFyIGk9dGhpcy5vcHRzW3RdO3RoaXMuY29uZlt0XTtvPWVbbl0uZ2xibCxpPXRoaXMub3B0c1t0XT1lLmV4dGVuZCghMCx7fSxlW25dLmRlZmF1bHRzW3RdLGkpO3ZhciBzPWZ1bmN0aW9uKGUpe3ZhciBuPXRoaXMuY29uZi5jbGFzc05hbWVzW3RdLmZpeGVkO3RoaXMuX19yZWZhY3RvckNsYXNzKGUuZmluZChcIi5cIituKSxuLFwic2xpZGVvdXRcIikuYXBwZW5kVG8oby4kYm9keSl9O3MuY2FsbCh0aGlzLG8uJHBhZ2UpLHRoaXMuYmluZChcInNldFBhZ2VcIixzKX19LGFkZDpmdW5jdGlvbigpe2k9ZVtuXS5fYyxzPWVbbl0uX2QsYT1lW25dLl9lLGkuYWRkKFwiZml4ZWRcIil9LGNsaWNrQW5jaG9yOmZ1bmN0aW9uKGUsbil7fX0sZVtuXS5jb25maWd1cmF0aW9uLmNsYXNzTmFtZXNbdF09e2ZpeGVkOlwiRml4ZWRcIn07dmFyIGkscyxhLG99KGpRdWVyeSksLypcdFxuICogalF1ZXJ5IG1tZW51IGRyb3Bkb3duIGFkZC1vblxuICogbW1lbnUuZnJlYnNpdGUubmxcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZyZWQgSGV1c3NjaGVuXG4gKi9cbmZ1bmN0aW9uKGUpe3ZhciBuPVwibW1lbnVcIix0PVwiZHJvcGRvd25cIjtlW25dLmFkZG9uc1t0XT17c2V0dXA6ZnVuY3Rpb24oKXtpZih0aGlzLm9wdHMub2ZmQ2FudmFzKXt2YXIgcj10aGlzLGw9dGhpcy5vcHRzW3RdLGQ9dGhpcy5jb25mW3RdO2lmKG89ZVtuXS5nbGJsLFwiYm9vbGVhblwiPT10eXBlb2YgbCYmbCYmKGw9e2Ryb3A6bH0pLFwib2JqZWN0XCIhPXR5cGVvZiBsJiYobD17fSksXCJzdHJpbmdcIj09dHlwZW9mIGwucG9zaXRpb24mJihsLnBvc2l0aW9uPXtvZjpsLnBvc2l0aW9ufSksbD10aGlzLm9wdHNbdF09ZS5leHRlbmQoITAse30sZVtuXS5kZWZhdWx0c1t0XSxsKSxsLmRyb3Ape2lmKFwic3RyaW5nXCIhPXR5cGVvZiBsLnBvc2l0aW9uLm9mKXt2YXIgYz10aGlzLiRtZW51LmF0dHIoXCJpZFwiKTtjJiZjLmxlbmd0aCYmKHRoaXMuY29uZi5jbG9uZSYmKGM9aS51bW0oYykpLGwucG9zaXRpb24ub2Y9J1tocmVmPVwiIycrYysnXCJdJyl9aWYoXCJzdHJpbmdcIj09dHlwZW9mIGwucG9zaXRpb24ub2Ype3ZhciBoPWUobC5wb3NpdGlvbi5vZik7aWYoaC5sZW5ndGgpe3RoaXMuJG1lbnUuYWRkQ2xhc3MoaS5kcm9wZG93biksbC50aXAmJnRoaXMuJG1lbnUuYWRkQ2xhc3MoaS50aXApLGwuZXZlbnQ9bC5ldmVudC5zcGxpdChcIiBcIiksMT09bC5ldmVudC5sZW5ndGgmJihsLmV2ZW50WzFdPWwuZXZlbnRbMF0pLFwiaG92ZXJcIj09bC5ldmVudFswXSYmaC5vbihhLm1vdXNlZW50ZXIrXCItZHJvcGRvd25cIixmdW5jdGlvbigpe3Iub3BlbigpfSksXCJob3ZlclwiPT1sLmV2ZW50WzFdJiZ0aGlzLiRtZW51Lm9uKGEubW91c2VsZWF2ZStcIi1kcm9wZG93blwiLGZ1bmN0aW9uKCl7ci5jbG9zZSgpfSksdGhpcy5iaW5kKFwib3BlbmluZ1wiLGZ1bmN0aW9uKCl7dGhpcy4kbWVudS5kYXRhKHMuc3R5bGUsdGhpcy4kbWVudS5hdHRyKFwic3R5bGVcIil8fFwiXCIpLG8uJGh0bWwuYWRkQ2xhc3MoaS5kcm9wZG93bil9KSx0aGlzLmJpbmQoXCJjbG9zZWRcIixmdW5jdGlvbigpe3RoaXMuJG1lbnUuYXR0cihcInN0eWxlXCIsdGhpcy4kbWVudS5kYXRhKHMuc3R5bGUpKSxvLiRodG1sLnJlbW92ZUNsYXNzKGkuZHJvcGRvd24pfSk7dmFyIHU9ZnVuY3Rpb24ocyxhKXt2YXIgcj1hWzBdLGM9YVsxXSx1PVwieFwiPT1zP1wic2Nyb2xsTGVmdFwiOlwic2Nyb2xsVG9wXCIsZj1cInhcIj09cz9cIm91dGVyV2lkdGhcIjpcIm91dGVySGVpZ2h0XCIscD1cInhcIj09cz9cImxlZnRcIjpcInRvcFwiLHY9XCJ4XCI9PXM/XCJyaWdodFwiOlwiYm90dG9tXCIsbT1cInhcIj09cz9cIndpZHRoXCI6XCJoZWlnaHRcIixnPVwieFwiPT1zP1wibWF4V2lkdGhcIjpcIm1heEhlaWdodFwiLGI9bnVsbCxfPW8uJHduZHdbdV0oKSxDPWgub2Zmc2V0KClbcF0tPV8seT1DK2hbZl0oKSwkPW8uJHduZHdbbV0oKSx3PWQub2Zmc2V0LmJ1dHRvbltzXStkLm9mZnNldC52aWV3cG9ydFtzXTtpZihsLnBvc2l0aW9uW3NdKXN3aXRjaChsLnBvc2l0aW9uW3NdKXtjYXNlXCJsZWZ0XCI6Y2FzZVwiYm90dG9tXCI6Yj1cImFmdGVyXCI7YnJlYWs7Y2FzZVwicmlnaHRcIjpjYXNlXCJ0b3BcIjpiPVwiYmVmb3JlXCJ9bnVsbD09PWImJihiPUMrKHktQykvMjwkLzI/XCJhZnRlclwiOlwiYmVmb3JlXCIpO3ZhciB4LGs7cmV0dXJuXCJhZnRlclwiPT1iPyh4PVwieFwiPT1zP0M6eSxrPSQtKHgrdykscltwXT14K2Qub2Zmc2V0LmJ1dHRvbltzXSxyW3ZdPVwiYXV0b1wiLGMucHVzaChpW1wieFwiPT1zP1widGlwbGVmdFwiOlwidGlwdG9wXCJdKSk6KHg9XCJ4XCI9PXM/eTpDLGs9eC13LHJbdl09XCJjYWxjKCAxMDAlIC0gXCIrKHgtZC5vZmZzZXQuYnV0dG9uW3NdKStcInB4IClcIixyW3BdPVwiYXV0b1wiLGMucHVzaChpW1wieFwiPT1zP1widGlwcmlnaHRcIjpcInRpcGJvdHRvbVwiXSkpLHJbZ109TWF0aC5taW4oZVtuXS5jb25maWd1cmF0aW9uW3RdW21dLm1heCxrKSxbcixjXX0sZj1mdW5jdGlvbihlKXtpZih0aGlzLnZhcnMub3BlbmVkKXt0aGlzLiRtZW51LmF0dHIoXCJzdHlsZVwiLHRoaXMuJG1lbnUuZGF0YShzLnN0eWxlKSk7dmFyIG49W3t9LFtdXTtuPXUuY2FsbCh0aGlzLFwieVwiLG4pLG49dS5jYWxsKHRoaXMsXCJ4XCIsbiksdGhpcy4kbWVudS5jc3MoblswXSksbC50aXAmJnRoaXMuJG1lbnUucmVtb3ZlQ2xhc3MoaS50aXBsZWZ0K1wiIFwiK2kudGlwcmlnaHQrXCIgXCIraS50aXB0b3ArXCIgXCIraS50aXBib3R0b20pLmFkZENsYXNzKG5bMV0uam9pbihcIiBcIikpfX07dGhpcy5iaW5kKFwib3BlbmluZ1wiLGYpLG8uJHduZHcub24oYS5yZXNpemUrXCItZHJvcGRvd25cIixmdW5jdGlvbihlKXtmLmNhbGwocil9KSx0aGlzLm9wdHMub2ZmQ2FudmFzLmJsb2NrVUl8fG8uJHduZHcub24oYS5zY3JvbGwrXCItZHJvcGRvd25cIixmdW5jdGlvbihlKXtmLmNhbGwocil9KX19fX19LGFkZDpmdW5jdGlvbigpe2k9ZVtuXS5fYyxzPWVbbl0uX2QsYT1lW25dLl9lLGkuYWRkKFwiZHJvcGRvd24gdGlwIHRpcGxlZnQgdGlwcmlnaHQgdGlwdG9wIHRpcGJvdHRvbVwiKSxhLmFkZChcIm1vdXNlZW50ZXIgbW91c2VsZWF2ZSByZXNpemUgc2Nyb2xsXCIpfSxjbGlja0FuY2hvcjpmdW5jdGlvbihlLG4pe319LGVbbl0uZGVmYXVsdHNbdF09e2Ryb3A6ITEsZXZlbnQ6XCJjbGlja1wiLHBvc2l0aW9uOnt9LHRpcDohMH0sZVtuXS5jb25maWd1cmF0aW9uW3RdPXtvZmZzZXQ6e2J1dHRvbjp7eDotMTAseToxMH0sdmlld3BvcnQ6e3g6MjAseToyMH19LGhlaWdodDp7bWF4Ojg4MH0sd2lkdGg6e21heDo0NDB9fTt2YXIgaSxzLGEsb30oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgaWNvblBhbmVscyBhZGQtb25cbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlxuICogQ29weXJpZ2h0IChjKSBGcmVkIEhldXNzY2hlblxuICovXG5mdW5jdGlvbihlKXt2YXIgbj1cIm1tZW51XCIsdD1cImljb25QYW5lbHNcIjtlW25dLmFkZG9uc1t0XT17c2V0dXA6ZnVuY3Rpb24oKXt2YXIgcz10aGlzLGE9dGhpcy5vcHRzW3RdO3RoaXMuY29uZlt0XTtpZihvPWVbbl0uZ2xibCxcImJvb2xlYW5cIj09dHlwZW9mIGEmJihhPXthZGQ6YX0pLFwibnVtYmVyXCI9PXR5cGVvZiBhJiYoYT17YWRkOiEwLHZpc2libGU6YX0pLFwib2JqZWN0XCIhPXR5cGVvZiBhJiYoYT17fSksYT10aGlzLm9wdHNbdF09ZS5leHRlbmQoITAse30sZVtuXS5kZWZhdWx0c1t0XSxhKSxhLnZpc2libGUrKyxhLmFkZCl7dGhpcy4kbWVudS5hZGRDbGFzcyhpLmljb25wYW5lbCk7Zm9yKHZhciByPVtdLGw9MDtsPD1hLnZpc2libGU7bCsrKXIucHVzaChpLmljb25wYW5lbCtcIi1cIitsKTtyPXIuam9pbihcIiBcIik7dmFyIGQ9ZnVuY3Rpb24obil7bi5oYXNDbGFzcyhpLnZlcnRpY2FsKXx8cy4kcG5scy5jaGlsZHJlbihcIi5cIitpLnBhbmVsKS5yZW1vdmVDbGFzcyhyKS5maWx0ZXIoXCIuXCIraS5zdWJvcGVuZWQpLnJlbW92ZUNsYXNzKGkuaGlkZGVuKS5hZGQobikubm90KFwiLlwiK2kudmVydGljYWwpLnNsaWNlKC1hLnZpc2libGUpLmVhY2goZnVuY3Rpb24obil7ZSh0aGlzKS5hZGRDbGFzcyhpLmljb25wYW5lbCtcIi1cIituKX0pfTt0aGlzLmJpbmQoXCJvcGVuUGFuZWxcIixkKSx0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIsZnVuY3Rpb24obil7ZC5jYWxsKHMscy4kcG5scy5jaGlsZHJlbihcIi5cIitpLmN1cnJlbnQpKSxuLm5vdChcIi5cIitpLnZlcnRpY2FsKS5lYWNoKGZ1bmN0aW9uKCl7ZSh0aGlzKS5jaGlsZHJlbihcIi5cIitpLnN1YmJsb2NrZXIpLmxlbmd0aHx8ZSh0aGlzKS5wcmVwZW5kKCc8YSBocmVmPVwiIycrZSh0aGlzKS5jbG9zZXN0KFwiLlwiK2kucGFuZWwpLmF0dHIoXCJpZFwiKSsnXCIgY2xhc3M9XCInK2kuc3ViYmxvY2tlcisnXCIgLz4nKX0pfSl9fSxhZGQ6ZnVuY3Rpb24oKXtpPWVbbl0uX2Mscz1lW25dLl9kLGE9ZVtuXS5fZSxpLmFkZChcImljb25wYW5lbCBzdWJibG9ja2VyXCIpfSxjbGlja0FuY2hvcjpmdW5jdGlvbihlLG4pe319LGVbbl0uZGVmYXVsdHNbdF09e2FkZDohMSx2aXNpYmxlOjN9O3ZhciBpLHMsYSxvfShqUXVlcnkpLC8qXHRcbiAqIGpRdWVyeSBtbWVudSBrZXlib2FyZE5hdmlnYXRpb24gYWRkLW9uXG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7ZnVuY3Rpb24gbihuLHQpe258fChuPXRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIrYS5jdXJyZW50KSk7dmFyIGk9ZSgpO1wiZGVmYXVsdFwiPT10JiYoaT1uLmNoaWxkcmVuKFwiLlwiK2EubGlzdHZpZXcpLmZpbmQoXCJhW2hyZWZdXCIpLm5vdChcIjpoaWRkZW5cIiksaS5sZW5ndGh8fChpPW4uZmluZChkKS5ub3QoXCI6aGlkZGVuXCIpKSxpLmxlbmd0aHx8KGk9dGhpcy4kbWVudS5jaGlsZHJlbihcIi5cIithLm5hdmJhcikuZmluZChkKS5ub3QoXCI6aGlkZGVuXCIpKSksaS5sZW5ndGh8fChpPXRoaXMuJG1lbnUuY2hpbGRyZW4oXCIuXCIrYS50YWJzdGFydCkpLGkuZmlyc3QoKS5mb2N1cygpfWZ1bmN0aW9uIHQoZSl7ZXx8KGU9dGhpcy4kcG5scy5jaGlsZHJlbihcIi5cIithLmN1cnJlbnQpKTt2YXIgbj10aGlzLiRwbmxzLmNoaWxkcmVuKFwiLlwiK2EucGFuZWwpLHQ9bi5ub3QoZSk7dC5maW5kKGQpLmF0dHIoXCJ0YWJpbmRleFwiLC0xKSxlLmZpbmQoZCkuYXR0cihcInRhYmluZGV4XCIsMCksZS5maW5kKFwiaW5wdXQubW0tdG9nZ2xlLCBpbnB1dC5tbS1jaGVja1wiKS5hdHRyKFwidGFiaW5kZXhcIiwtMSl9dmFyIGk9XCJtbWVudVwiLHM9XCJrZXlib2FyZE5hdmlnYXRpb25cIjtlW2ldLmFkZG9uc1tzXT17c2V0dXA6ZnVuY3Rpb24oKXt2YXIgbz10aGlzLHI9dGhpcy5vcHRzW3NdO3RoaXMuY29uZltzXTtpZihsPWVbaV0uZ2xibCxcImJvb2xlYW5cIiE9dHlwZW9mIHImJlwic3RyaW5nXCIhPXR5cGVvZiByfHwocj17ZW5hYmxlOnJ9KSxcIm9iamVjdFwiIT10eXBlb2YgciYmKHI9e30pLHI9dGhpcy5vcHRzW3NdPWUuZXh0ZW5kKCEwLHt9LGVbaV0uZGVmYXVsdHNbc10sciksci5lbmFibGUpe3IuZW5oYW5jZSYmdGhpcy4kbWVudS5hZGRDbGFzcyhhLmtleWJvYXJkZm9jdXMpO3ZhciBjPWUoJzxpbnB1dCBjbGFzcz1cIicrYS50YWJzdGFydCsnXCIgdGFiaW5kZXg9XCIwXCIgdHlwZT1cInRleHRcIiAvPicpLGg9ZSgnPGlucHV0IGNsYXNzPVwiJythLnRhYmVuZCsnXCIgdGFiaW5kZXg9XCIwXCIgdHlwZT1cInRleHRcIiAvPicpO3RoaXMuYmluZChcImluaXRQYW5lbHNcIixmdW5jdGlvbigpe3RoaXMuJG1lbnUucHJlcGVuZChjKS5hcHBlbmQoaCkuY2hpbGRyZW4oXCIuXCIrYS5uYXZiYXIpLmZpbmQoZCkuYXR0cihcInRhYmluZGV4XCIsMCl9KSx0aGlzLmJpbmQoXCJvcGVuXCIsZnVuY3Rpb24oKXt0LmNhbGwodGhpcyksdGhpcy5fX3RyYW5zaXRpb25lbmQodGhpcy4kbWVudSxmdW5jdGlvbigpe24uY2FsbChvLG51bGwsci5lbmFibGUpfSx0aGlzLmNvbmYudHJhbnNpdGlvbkR1cmF0aW9uKX0pLHRoaXMuYmluZChcIm9wZW5QYW5lbFwiLGZ1bmN0aW9uKGUpe3QuY2FsbCh0aGlzLGUpLHRoaXMuX190cmFuc2l0aW9uZW5kKGUsZnVuY3Rpb24oKXtuLmNhbGwobyxlLHIuZW5hYmxlKX0sdGhpcy5jb25mLnRyYW5zaXRpb25EdXJhdGlvbil9KSx0aGlzW1wiX2luaXRXaW5kb3dfXCIrc10oci5lbmhhbmNlKX19LGFkZDpmdW5jdGlvbigpe2E9ZVtpXS5fYyxvPWVbaV0uX2Qscj1lW2ldLl9lLGEuYWRkKFwidGFic3RhcnQgdGFiZW5kIGtleWJvYXJkZm9jdXNcIiksci5hZGQoXCJmb2N1c2luIGtleWRvd25cIil9LGNsaWNrQW5jaG9yOmZ1bmN0aW9uKGUsbil7fX0sZVtpXS5kZWZhdWx0c1tzXT17ZW5hYmxlOiExLGVuaGFuY2U6ITF9LGVbaV0uY29uZmlndXJhdGlvbltzXT17fSxlW2ldLnByb3RvdHlwZVtcIl9pbml0V2luZG93X1wiK3NdPWZ1bmN0aW9uKG4pe2wuJHduZHcub2ZmKHIua2V5ZG93bitcIi1vZmZDYW52YXNcIiksbC4kd25kdy5vZmYoci5mb2N1c2luK1wiLVwiK3MpLm9uKHIuZm9jdXNpbitcIi1cIitzLGZ1bmN0aW9uKG4pe2lmKGwuJGh0bWwuaGFzQ2xhc3MoYS5vcGVuZWQpKXt2YXIgdD1lKG4udGFyZ2V0KTt0LmlzKFwiLlwiK2EudGFiZW5kKSYmdC5wYXJlbnQoKS5maW5kKFwiLlwiK2EudGFic3RhcnQpLmZvY3VzKCl9fSksbC4kd25kdy5vZmYoci5rZXlkb3duK1wiLVwiK3MpLm9uKHIua2V5ZG93bitcIi1cIitzLGZ1bmN0aW9uKG4pe3ZhciB0PWUobi50YXJnZXQpLGk9dC5jbG9zZXN0KFwiLlwiK2EubWVudSk7aWYoaS5sZW5ndGgpe2kuZGF0YShcIm1tZW51XCIpO2lmKHQuaXMoXCJpbnB1dCwgdGV4dGFyZWFcIikpO2Vsc2Ugc3dpdGNoKG4ua2V5Q29kZSl7Y2FzZSAxMzoodC5pcyhcIi5tbS10b2dnbGVcIil8fHQuaXMoXCIubW0tY2hlY2tcIikpJiZ0LnRyaWdnZXIoci5jbGljayk7YnJlYWs7Y2FzZSAzMjpjYXNlIDM3OmNhc2UgMzg6Y2FzZSAzOTpjYXNlIDQwOm4ucHJldmVudERlZmF1bHQoKX19fSksbiYmbC4kd25kdy5vbihyLmtleWRvd24rXCItXCIrcyxmdW5jdGlvbihuKXt2YXIgdD1lKG4udGFyZ2V0KSxpPXQuY2xvc2VzdChcIi5cIithLm1lbnUpO2lmKGkubGVuZ3RoKXt2YXIgcz1pLmRhdGEoXCJtbWVudVwiKTtpZih0LmlzKFwiaW5wdXQsIHRleHRhcmVhXCIpKXN3aXRjaChuLmtleUNvZGUpe2Nhc2UgMjc6dC52YWwoXCJcIil9ZWxzZSBzd2l0Y2gobi5rZXlDb2RlKXtjYXNlIDg6dmFyIHI9dC5jbG9zZXN0KFwiLlwiK2EucGFuZWwpLmRhdGEoby5wYXJlbnQpO3ImJnIubGVuZ3RoJiZzLm9wZW5QYW5lbChyLmNsb3Nlc3QoXCIuXCIrYS5wYW5lbCkpO2JyZWFrO2Nhc2UgMjc6aS5oYXNDbGFzcyhhLm9mZmNhbnZhcykmJnMuY2xvc2UoKX19fSl9O3ZhciBhLG8scixsLGQ9XCJpbnB1dCwgc2VsZWN0LCB0ZXh0YXJlYSwgYnV0dG9uLCBsYWJlbCwgYVtocmVmXVwifShqUXVlcnkpLC8qXHRcbiAqIGpRdWVyeSBtbWVudSBsYXp5U3VibWVudXMgYWRkLW9uXG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7dmFyIG49XCJtbWVudVwiLHQ9XCJsYXp5U3VibWVudXNcIjtlW25dLmFkZG9uc1t0XT17c2V0dXA6ZnVuY3Rpb24oKXt2YXIgYT10aGlzLm9wdHNbdF07dGhpcy5jb25mW3RdO289ZVtuXS5nbGJsLFwiYm9vbGVhblwiPT10eXBlb2YgYSYmKGE9e2xvYWQ6YX0pLFwib2JqZWN0XCIhPXR5cGVvZiBhJiYoYT17fSksYT10aGlzLm9wdHNbdF09ZS5leHRlbmQoITAse30sZVtuXS5kZWZhdWx0c1t0XSxhKSxhLmxvYWQmJih0aGlzLiRtZW51LmZpbmQoXCJsaVwiKS5maW5kKFwibGlcIikuY2hpbGRyZW4odGhpcy5jb25mLnBhbmVsTm9kZXR5cGUpLmVhY2goZnVuY3Rpb24oKXtlKHRoaXMpLnBhcmVudCgpLmFkZENsYXNzKGkubGF6eXN1Ym1lbnUpLmRhdGEocy5sYXp5c3VibWVudSx0aGlzKS5lbmQoKS5yZW1vdmUoKX0pLHRoaXMuYmluZChcIm9wZW5pbmdQYW5lbFwiLGZ1bmN0aW9uKG4pe3ZhciB0PW4uZmluZChcIi5cIitpLmxhenlzdWJtZW51KTt0Lmxlbmd0aCYmKHQuZWFjaChmdW5jdGlvbigpe2UodGhpcykuYXBwZW5kKGUodGhpcykuZGF0YShzLmxhenlzdWJtZW51KSkucmVtb3ZlRGF0YShzLmxhenlzdWJtZW51KS5yZW1vdmVDbGFzcyhpLmxhenlzdWJtZW51KX0pLHRoaXMuaW5pdFBhbmVscyhuKSl9KSl9LGFkZDpmdW5jdGlvbigpe2k9ZVtuXS5fYyxzPWVbbl0uX2QsYT1lW25dLl9lLGkuYWRkKFwibGF6eXN1Ym1lbnVcIikscy5hZGQoXCJsYXp5c3VibWVudVwiKX0sY2xpY2tBbmNob3I6ZnVuY3Rpb24oZSxuKXt9fSxlW25dLmRlZmF1bHRzW3RdPXtsb2FkOiExfSxlW25dLmNvbmZpZ3VyYXRpb25bdF09e307dmFyIGkscyxhLG99KGpRdWVyeSksLypcdFxuICogalF1ZXJ5IG1tZW51IG5hdmJhciBhZGQtb25cbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlxuICogQ29weXJpZ2h0IChjKSBGcmVkIEhldXNzY2hlblxuICovXG5mdW5jdGlvbihlKXt2YXIgbj1cIm1tZW51XCIsdD1cIm5hdmJhcnNcIjtlW25dLmFkZG9uc1t0XT17c2V0dXA6ZnVuY3Rpb24oKXt2YXIgcz10aGlzLGE9dGhpcy5vcHRzW3RdLHI9dGhpcy5jb25mW3RdO2lmKG89ZVtuXS5nbGJsLFwidW5kZWZpbmVkXCIhPXR5cGVvZiBhKXthIGluc3RhbmNlb2YgQXJyYXl8fChhPVthXSk7dmFyIGw9e307aWYoYS5sZW5ndGgpe2UuZWFjaChhLGZ1bmN0aW9uKG8pe3ZhciBkPWFbb107XCJib29sZWFuXCI9PXR5cGVvZiBkJiZkJiYoZD17fSksXCJvYmplY3RcIiE9dHlwZW9mIGQmJihkPXt9KSxcInVuZGVmaW5lZFwiPT10eXBlb2YgZC5jb250ZW50JiYoZC5jb250ZW50PVtcInByZXZcIixcInRpdGxlXCJdKSxkLmNvbnRlbnQgaW5zdGFuY2VvZiBBcnJheXx8KGQuY29udGVudD1bZC5jb250ZW50XSksZD1lLmV4dGVuZCghMCx7fSxzLm9wdHMubmF2YmFyLGQpO3ZhciBjPWQucG9zaXRpb24saD1kLmhlaWdodDtcIm51bWJlclwiIT10eXBlb2YgaCYmKGg9MSksaD1NYXRoLm1pbig0LE1hdGgubWF4KDEsaCkpLFwiYm90dG9tXCIhPWMmJihjPVwidG9wXCIpLGxbY118fChsW2NdPTApLGxbY10rKzt2YXIgdT1lKFwiPGRpdiAvPlwiKS5hZGRDbGFzcyhpLm5hdmJhcitcIiBcIitpLm5hdmJhcitcIi1cIitjK1wiIFwiK2kubmF2YmFyK1wiLVwiK2MrXCItXCIrbFtjXStcIiBcIitpLm5hdmJhcitcIi1zaXplLVwiK2gpO2xbY10rPWgtMTtmb3IodmFyIGY9MCxwPTAsdj1kLmNvbnRlbnQubGVuZ3RoO3A8djtwKyspe3ZhciBtPWVbbl0uYWRkb25zW3RdW2QuY29udGVudFtwXV18fCExO20/Zis9bS5jYWxsKHMsdSxkLHIpOihtPWQuY29udGVudFtwXSxtIGluc3RhbmNlb2YgZXx8KG09ZShkLmNvbnRlbnRbcF0pKSx1LmFwcGVuZChtKSl9Zis9TWF0aC5jZWlsKHUuY2hpbGRyZW4oKS5ub3QoXCIuXCIraS5idG4pLmxlbmd0aC9oKSxmPjEmJnUuYWRkQ2xhc3MoaS5uYXZiYXIrXCItY29udGVudC1cIitmKSx1LmNoaWxkcmVuKFwiLlwiK2kuYnRuKS5sZW5ndGgmJnUuYWRkQ2xhc3MoaS5oYXNidG5zKSx1LnByZXBlbmRUbyhzLiRtZW51KX0pO2Zvcih2YXIgZCBpbiBsKXMuJG1lbnUuYWRkQ2xhc3MoaS5oYXNuYXZiYXIrXCItXCIrZCtcIi1cIitsW2RdKX19fSxhZGQ6ZnVuY3Rpb24oKXtpPWVbbl0uX2Mscz1lW25dLl9kLGE9ZVtuXS5fZSxpLmFkZChcImNsb3NlIGhhc2J0bnNcIil9LGNsaWNrQW5jaG9yOmZ1bmN0aW9uKGUsbil7fX0sZVtuXS5jb25maWd1cmF0aW9uW3RdPXticmVhZGNydW1iU2VwYXJhdG9yOlwiL1wifSxlW25dLmNvbmZpZ3VyYXRpb24uY2xhc3NOYW1lc1t0XT17fTt2YXIgaSxzLGEsb30oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgbmF2YmFyIGFkZC1vbiBicmVhZGNydW1icyBjb250ZW50XG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7dmFyIG49XCJtbWVudVwiLHQ9XCJuYXZiYXJzXCIsaT1cImJyZWFkY3J1bWJzXCI7ZVtuXS5hZGRvbnNbdF1baV09ZnVuY3Rpb24odCxpLHMpe3ZhciBhPWVbbl0uX2Msbz1lW25dLl9kO2EuYWRkKFwiYnJlYWRjcnVtYnMgc2VwYXJhdG9yXCIpO3ZhciByPWUoJzxzcGFuIGNsYXNzPVwiJythLmJyZWFkY3J1bWJzKydcIiAvPicpLmFwcGVuZFRvKHQpO3RoaXMuYmluZChcImluaXRQYW5lbHNcIixmdW5jdGlvbihuKXtuLnJlbW92ZUNsYXNzKGEuaGFzbmF2YmFyKS5lYWNoKGZ1bmN0aW9uKCl7Zm9yKHZhciBuPVtdLHQ9ZSh0aGlzKSxpPWUoJzxzcGFuIGNsYXNzPVwiJythLmJyZWFkY3J1bWJzKydcIj48L3NwYW4+Jykscj1lKHRoaXMpLmNoaWxkcmVuKCkuZmlyc3QoKSxsPSEwO3ImJnIubGVuZ3RoOyl7ci5pcyhcIi5cIithLnBhbmVsKXx8KHI9ci5jbG9zZXN0KFwiLlwiK2EucGFuZWwpKTt2YXIgZD1yLmNoaWxkcmVuKFwiLlwiK2EubmF2YmFyKS5jaGlsZHJlbihcIi5cIithLnRpdGxlKS50ZXh0KCk7bi51bnNoaWZ0KGw/XCI8c3Bhbj5cIitkK1wiPC9zcGFuPlwiOic8YSBocmVmPVwiIycrci5hdHRyKFwiaWRcIikrJ1wiPicrZCtcIjwvYT5cIiksbD0hMSxyPXIuZGF0YShvLnBhcmVudCl9aS5hcHBlbmQobi5qb2luKCc8c3BhbiBjbGFzcz1cIicrYS5zZXBhcmF0b3IrJ1wiPicrcy5icmVhZGNydW1iU2VwYXJhdG9yK1wiPC9zcGFuPlwiKSkuYXBwZW5kVG8odC5jaGlsZHJlbihcIi5cIithLm5hdmJhcikpfSl9KTt2YXIgbD1mdW5jdGlvbigpe3IuaHRtbCh0aGlzLiRwbmxzLmNoaWxkcmVuKFwiLlwiK2EuY3VycmVudCkuY2hpbGRyZW4oXCIuXCIrYS5uYXZiYXIpLmNoaWxkcmVuKFwiLlwiK2EuYnJlYWRjcnVtYnMpLmh0bWwoKSl9O3JldHVybiB0aGlzLmJpbmQoXCJvcGVuUGFuZWxcIixsKSx0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIsbCksMH19KGpRdWVyeSksLypcdFxuICogalF1ZXJ5IG1tZW51IG5hdmJhciBhZGQtb24gY2xvc2UgY29udGVudFxuICogbW1lbnUuZnJlYnNpdGUubmxcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZyZWQgSGV1c3NjaGVuXG4gKi9cbmZ1bmN0aW9uKGUpe3ZhciBuPVwibW1lbnVcIix0PVwibmF2YmFyc1wiLGk9XCJjbG9zZVwiO2Vbbl0uYWRkb25zW3RdW2ldPWZ1bmN0aW9uKHQsaSl7dmFyIHM9ZVtuXS5fYyxhPWVbbl0uZ2xibCxvPWUoJzxhIGNsYXNzPVwiJytzLmNsb3NlK1wiIFwiK3MuYnRuKydcIiBocmVmPVwiI1wiIC8+JykuYXBwZW5kVG8odCkscj1mdW5jdGlvbihlKXtvLmF0dHIoXCJocmVmXCIsXCIjXCIrZS5hdHRyKFwiaWRcIikpfTtyZXR1cm4gci5jYWxsKHRoaXMsYS4kcGFnZSksdGhpcy5iaW5kKFwic2V0UGFnZVwiLHIpLC0xfX0oalF1ZXJ5KSwvKlxuICogalF1ZXJ5IG1tZW51IG5hdmJhciBhZGQtb24gbmV4dCBjb250ZW50XG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7dmFyIG49XCJtbWVudVwiLHQ9XCJuYXZiYXJzXCIsaT1cIm5leHRcIjtlW25dLmFkZG9uc1t0XVtpXT1mdW5jdGlvbihpLHMpe3ZhciBhLG8scixsPWVbbl0uX2MsZD1lKCc8YSBjbGFzcz1cIicrbC5uZXh0K1wiIFwiK2wuYnRuKydcIiBocmVmPVwiI1wiIC8+JykuYXBwZW5kVG8oaSksYz1mdW5jdGlvbihlKXtlPWV8fHRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIrbC5jdXJyZW50KTt2YXIgbj1lLmZpbmQoXCIuXCIrdGhpcy5jb25mLmNsYXNzTmFtZXNbdF0ucGFuZWxOZXh0KTthPW4uYXR0cihcImhyZWZcIikscj1uLmF0dHIoXCJhcmlhLW93bnNcIiksbz1uLmh0bWwoKSxkW2E/XCJhdHRyXCI6XCJyZW1vdmVBdHRyXCJdKFwiaHJlZlwiLGEpLGRbcj9cImF0dHJcIjpcInJlbW92ZUF0dHJcIl0oXCJhcmlhLW93bnNcIixyKSxkW2F8fG8/XCJyZW1vdmVDbGFzc1wiOlwiYWRkQ2xhc3NcIl0obC5oaWRkZW4pLGQuaHRtbChvKX07cmV0dXJuIHRoaXMuYmluZChcIm9wZW5QYW5lbFwiLGMpLHRoaXMuYmluZChcImluaXRQYW5lbHNcIixmdW5jdGlvbigpe2MuY2FsbCh0aGlzKX0pLC0xfSxlW25dLmNvbmZpZ3VyYXRpb24uY2xhc3NOYW1lc1t0XS5wYW5lbE5leHQ9XCJOZXh0XCJ9KGpRdWVyeSksLypcbiAqIGpRdWVyeSBtbWVudSBuYXZiYXIgYWRkLW9uIHByZXYgY29udGVudFxuICogbW1lbnUuZnJlYnNpdGUubmxcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZyZWQgSGV1c3NjaGVuXG4gKi9cbmZ1bmN0aW9uKGUpe3ZhciBuPVwibW1lbnVcIix0PVwibmF2YmFyc1wiLGk9XCJwcmV2XCI7ZVtuXS5hZGRvbnNbdF1baV09ZnVuY3Rpb24oaSxzKXt2YXIgYT1lW25dLl9jLG89ZSgnPGEgY2xhc3M9XCInK2EucHJlditcIiBcIithLmJ0bisnXCIgaHJlZj1cIiNcIiAvPicpLmFwcGVuZFRvKGkpO3RoaXMuYmluZChcImluaXRQYW5lbHNcIixmdW5jdGlvbihlKXtlLnJlbW92ZUNsYXNzKGEuaGFzbmF2YmFyKS5jaGlsZHJlbihcIi5cIithLm5hdmJhcikuYWRkQ2xhc3MoYS5oaWRkZW4pfSk7dmFyIHIsbCxkLGM9ZnVuY3Rpb24oZSl7aWYoZT1lfHx0aGlzLiRwbmxzLmNoaWxkcmVuKFwiLlwiK2EuY3VycmVudCksIWUuaGFzQ2xhc3MoYS52ZXJ0aWNhbCkpe3ZhciBuPWUuZmluZChcIi5cIit0aGlzLmNvbmYuY2xhc3NOYW1lc1t0XS5wYW5lbFByZXYpO24ubGVuZ3RofHwobj1lLmNoaWxkcmVuKFwiLlwiK2EubmF2YmFyKS5jaGlsZHJlbihcIi5cIithLnByZXYpKSxyPW4uYXR0cihcImhyZWZcIiksZD1uLmF0dHIoXCJhcmlhLW93bnNcIiksbD1uLmh0bWwoKSxvW3I/XCJhdHRyXCI6XCJyZW1vdmVBdHRyXCJdKFwiaHJlZlwiLHIpLG9bZD9cImF0dHJcIjpcInJlbW92ZUF0dHJcIl0oXCJhcmlhLW93bnNcIixkKSxvW3J8fGw/XCJyZW1vdmVDbGFzc1wiOlwiYWRkQ2xhc3NcIl0oYS5oaWRkZW4pLG8uaHRtbChsKX19O3JldHVybiB0aGlzLmJpbmQoXCJvcGVuUGFuZWxcIixjKSx0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIsZnVuY3Rpb24oKXtjLmNhbGwodGhpcyl9KSwtMX0sZVtuXS5jb25maWd1cmF0aW9uLmNsYXNzTmFtZXNbdF0ucGFuZWxQcmV2PVwiUHJldlwifShqUXVlcnkpLC8qXHRcbiAqIGpRdWVyeSBtbWVudSBuYXZiYXIgYWRkLW9uIHNlYXJjaGZpZWxkIGNvbnRlbnRcbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlxuICogQ29weXJpZ2h0IChjKSBGcmVkIEhldXNzY2hlblxuICovXG5mdW5jdGlvbihlKXt2YXIgbj1cIm1tZW51XCIsdD1cIm5hdmJhcnNcIixpPVwic2VhcmNoZmllbGRcIjtlW25dLmFkZG9uc1t0XVtpXT1mdW5jdGlvbih0LGkpe3ZhciBzPWVbbl0uX2MsYT1lKCc8ZGl2IGNsYXNzPVwiJytzLnNlYXJjaCsnXCIgLz4nKS5hcHBlbmRUbyh0KTtyZXR1cm5cIm9iamVjdFwiIT10eXBlb2YgdGhpcy5vcHRzLnNlYXJjaGZpZWxkJiYodGhpcy5vcHRzLnNlYXJjaGZpZWxkPXt9KSx0aGlzLm9wdHMuc2VhcmNoZmllbGQuYWRkPSEwLHRoaXMub3B0cy5zZWFyY2hmaWVsZC5hZGRUbz1hLDB9fShqUXVlcnkpLC8qXHRcbiAqIGpRdWVyeSBtbWVudSBuYXZiYXIgYWRkLW9uIHRpdGxlIGNvbnRlbnRcbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlxuICogQ29weXJpZ2h0IChjKSBGcmVkIEhldXNzY2hlblxuICovXG5mdW5jdGlvbihlKXt2YXIgbj1cIm1tZW51XCIsdD1cIm5hdmJhcnNcIixpPVwidGl0bGVcIjtlW25dLmFkZG9uc1t0XVtpXT1mdW5jdGlvbihpLHMpe3ZhciBhLG8scj1lW25dLl9jLGw9ZSgnPGEgY2xhc3M9XCInK3IudGl0bGUrJ1wiIC8+JykuYXBwZW5kVG8oaSksZD1mdW5jdGlvbihlKXtpZihlPWV8fHRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIrci5jdXJyZW50KSwhZS5oYXNDbGFzcyhyLnZlcnRpY2FsKSl7dmFyIG49ZS5maW5kKFwiLlwiK3RoaXMuY29uZi5jbGFzc05hbWVzW3RdLnBhbmVsVGl0bGUpO24ubGVuZ3RofHwobj1lLmNoaWxkcmVuKFwiLlwiK3IubmF2YmFyKS5jaGlsZHJlbihcIi5cIityLnRpdGxlKSksYT1uLmF0dHIoXCJocmVmXCIpLG89bi5odG1sKCl8fHMudGl0bGUsbFthP1wiYXR0clwiOlwicmVtb3ZlQXR0clwiXShcImhyZWZcIixhKSxsW2F8fG8/XCJyZW1vdmVDbGFzc1wiOlwiYWRkQ2xhc3NcIl0oci5oaWRkZW4pLGwuaHRtbChvKX19O3JldHVybiB0aGlzLmJpbmQoXCJvcGVuUGFuZWxcIixkKSx0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIsZnVuY3Rpb24oZSl7ZC5jYWxsKHRoaXMpfSksMH0sZVtuXS5jb25maWd1cmF0aW9uLmNsYXNzTmFtZXNbdF0ucGFuZWxUaXRsZT1cIlRpdGxlXCJ9KGpRdWVyeSksLypcdFxuICogalF1ZXJ5IG1tZW51IFJUTCBhZGQtb25cbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlxuICogQ29weXJpZ2h0IChjKSBGcmVkIEhldXNzY2hlblxuICovXG5mdW5jdGlvbihlKXt2YXIgbj1cIm1tZW51XCIsdD1cInJ0bFwiO2Vbbl0uYWRkb25zW3RdPXtzZXR1cDpmdW5jdGlvbigpe3ZhciBzPXRoaXMub3B0c1t0XTt0aGlzLmNvbmZbdF07bz1lW25dLmdsYmwsXCJvYmplY3RcIiE9dHlwZW9mIHMmJihzPXt1c2U6c30pLHM9dGhpcy5vcHRzW3RdPWUuZXh0ZW5kKCEwLHt9LGVbbl0uZGVmYXVsdHNbdF0scyksXCJib29sZWFuXCIhPXR5cGVvZiBzLnVzZSYmKHMudXNlPVwicnRsXCI9PShvLiRodG1sLmF0dHIoXCJkaXJcIil8fFwiXCIpLnRvTG93ZXJDYXNlKCkpLHMudXNlJiZ0aGlzLiRtZW51LmFkZENsYXNzKGkucnRsKX0sYWRkOmZ1bmN0aW9uKCl7aT1lW25dLl9jLHM9ZVtuXS5fZCxhPWVbbl0uX2UsaS5hZGQoXCJydGxcIil9LGNsaWNrQW5jaG9yOmZ1bmN0aW9uKGUsbil7fX0sZVtuXS5kZWZhdWx0c1t0XT17dXNlOlwiZGV0ZWN0XCJ9O3ZhciBpLHMsYSxvfShqUXVlcnkpLC8qXG4gKiBqUXVlcnkgbW1lbnUgc2NyZWVuUmVhZGVyIGFkZC1vblxuICogbW1lbnUuZnJlYnNpdGUubmxcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIEZyZWQgSGV1c3NjaGVuXG4gKi9cbmZ1bmN0aW9uKGUpe2Z1bmN0aW9uIG4oZSxuLHQpe2UucHJvcChcImFyaWEtXCIrbix0KVt0P1wiYXR0clwiOlwicmVtb3ZlQXR0clwiXShcImFyaWEtXCIrbix0KX1mdW5jdGlvbiB0KGUpe3JldHVybic8c3BhbiBjbGFzcz1cIicrYS5zcm9ubHkrJ1wiPicrZStcIjwvc3Bhbj5cIn12YXIgaT1cIm1tZW51XCIscz1cInNjcmVlblJlYWRlclwiO2VbaV0uYWRkb25zW3NdPXtzZXR1cDpmdW5jdGlvbigpe3ZhciBvPXRoaXMub3B0c1tzXSxyPXRoaXMuY29uZltzXTtpZihsPWVbaV0uZ2xibCxcImJvb2xlYW5cIj09dHlwZW9mIG8mJihvPXthcmlhOm8sdGV4dDpvfSksXCJvYmplY3RcIiE9dHlwZW9mIG8mJihvPXt9KSxvPXRoaXMub3B0c1tzXT1lLmV4dGVuZCghMCx7fSxlW2ldLmRlZmF1bHRzW3NdLG8pLG8uYXJpYSl7aWYodGhpcy5vcHRzLm9mZkNhbnZhcyl7dmFyIGQ9ZnVuY3Rpb24oKXtuKHRoaXMuJG1lbnUsXCJoaWRkZW5cIiwhMSl9LGM9ZnVuY3Rpb24oKXtuKHRoaXMuJG1lbnUsXCJoaWRkZW5cIiwhMCl9O3RoaXMuYmluZChcIm9wZW5cIixkKSx0aGlzLmJpbmQoXCJjbG9zZVwiLGMpLG4odGhpcy4kbWVudSxcImhpZGRlblwiLCEwKX12YXIgaD1mdW5jdGlvbigpe30sdT1mdW5jdGlvbihlKXt2YXIgdD10aGlzLiRtZW51LmNoaWxkcmVuKFwiLlwiK2EubmF2YmFyKSxpPXQuY2hpbGRyZW4oXCIuXCIrYS5wcmV2KSxzPXQuY2hpbGRyZW4oXCIuXCIrYS5uZXh0KSxyPXQuY2hpbGRyZW4oXCIuXCIrYS50aXRsZSk7bihpLFwiaGlkZGVuXCIsaS5pcyhcIi5cIithLmhpZGRlbikpLG4ocyxcImhpZGRlblwiLHMuaXMoXCIuXCIrYS5oaWRkZW4pKSxvLnRleHQmJm4ocixcImhpZGRlblwiLCFpLmlzKFwiLlwiK2EuaGlkZGVuKSksbih0aGlzLiRwbmxzLmNoaWxkcmVuKFwiLlwiK2EucGFuZWwpLm5vdChlKSxcImhpZGRlblwiLCEwKSxuKGUsXCJoaWRkZW5cIiwhMSl9O3RoaXMuYmluZChcInVwZGF0ZVwiLGgpLHRoaXMuYmluZChcIm9wZW5QYW5lbFwiLGgpLHRoaXMuYmluZChcIm9wZW5QYW5lbFwiLHUpO3ZhciBmPWZ1bmN0aW9uKHQpe3ZhciBpO3Q9dHx8dGhpcy4kbWVudTt2YXIgcz10LmNoaWxkcmVuKFwiLlwiK2EubmF2YmFyKSxyPXMuY2hpbGRyZW4oXCIuXCIrYS5wcmV2KSxsPXMuY2hpbGRyZW4oXCIuXCIrYS5uZXh0KTtzLmNoaWxkcmVuKFwiLlwiK2EudGl0bGUpO24ocixcImhhc3BvcHVwXCIsITApLG4obCxcImhhc3BvcHVwXCIsITApLGk9dC5pcyhcIi5cIithLnBhbmVsKT90LmZpbmQoXCIuXCIrYS5wcmV2K1wiLCAuXCIrYS5uZXh0KTpyLmFkZChsKSxpLmVhY2goZnVuY3Rpb24oKXtuKGUodGhpcyksXCJvd25zXCIsZSh0aGlzKS5hdHRyKFwiaHJlZlwiKS5yZXBsYWNlKFwiI1wiLFwiXCIpKX0pLG8udGV4dCYmdC5pcyhcIi5cIithLnBhbmVsKSYmKGk9dC5maW5kKFwiLlwiK2EubGlzdHZpZXcpLmZpbmQoXCIuXCIrYS5mdWxsc3Vib3BlbikucGFyZW50KCkuY2hpbGRyZW4oXCJzcGFuXCIpLG4oaSxcImhpZGRlblwiLCEwKSl9O3RoaXMuYmluZChcImluaXRQYW5lbHNcIixmKSx0aGlzLmJpbmQoXCJfaW5pdEFkZG9uc1wiLGYpfWlmKG8udGV4dCl7dmFyIHA9ZnVuY3Rpb24obil7dmFyIHM7bj1ufHx0aGlzLiRtZW51O3ZhciBvPW4uY2hpbGRyZW4oXCIuXCIrYS5uYXZiYXIpO28uZWFjaChmdW5jdGlvbigpe3ZhciBuPWUodGhpcyksbz1lW2ldLmkxOG4oci50ZXh0LmNsb3NlU3VibWVudSk7cz1uLmNoaWxkcmVuKFwiLlwiK2EudGl0bGUpLHMubGVuZ3RoJiYobys9XCIgKFwiK3MudGV4dCgpK1wiKVwiKSxuLmNoaWxkcmVuKFwiLlwiK2EucHJldikuaHRtbCh0KG8pKX0pLG8uY2hpbGRyZW4oXCIuXCIrYS5jbG9zZSkuaHRtbCh0KGVbaV0uaTE4bihyLnRleHQuY2xvc2VNZW51KSkpLG4uaXMoXCIuXCIrYS5wYW5lbCkmJm4uZmluZChcIi5cIithLmxpc3R2aWV3KS5jaGlsZHJlbihcImxpXCIpLmNoaWxkcmVuKFwiLlwiK2EubmV4dCkuZWFjaChmdW5jdGlvbigpe3ZhciBuPWUodGhpcyksbz1lW2ldLmkxOG4oci50ZXh0W24ucGFyZW50KCkuaXMoXCIuXCIrYS52ZXJ0aWNhbCk/XCJ0b2dnbGVTdWJtZW51XCI6XCJvcGVuU3VibWVudVwiXSk7cz1uLm5leHRBbGwoXCJzcGFuLCBhXCIpLmZpcnN0KCkscy5sZW5ndGgmJihvKz1cIiAoXCIrcy50ZXh0KCkrXCIpXCIpLG4uaHRtbCh0KG8pKX0pfTt0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIscCksdGhpcy5iaW5kKFwiX2luaXRBZGRvbnNcIixwKX19LGFkZDpmdW5jdGlvbigpe2E9ZVtpXS5fYyxvPWVbaV0uX2Qscj1lW2ldLl9lLGEuYWRkKFwic3Jvbmx5XCIpfSxjbGlja0FuY2hvcjpmdW5jdGlvbihlLG4pe319LGVbaV0uZGVmYXVsdHNbc109e2FyaWE6ITEsdGV4dDohMX0sZVtpXS5jb25maWd1cmF0aW9uW3NdPXt0ZXh0OntjbG9zZU1lbnU6XCJDbG9zZSBtZW51XCIsY2xvc2VTdWJtZW51OlwiQ2xvc2Ugc3VibWVudVwiLG9wZW5TdWJtZW51OlwiT3BlbiBzdWJtZW51XCIsdG9nZ2xlU3VibWVudTpcIlRvZ2dsZSBzdWJtZW51XCJ9fTt2YXIgYSxvLHIsbH0oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgc2VhcmNoZmllbGQgYWRkLW9uXG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7ZnVuY3Rpb24gbihlKXtzd2l0Y2goZSl7Y2FzZSA5OmNhc2UgMTY6Y2FzZSAxNzpjYXNlIDE4OmNhc2UgMzc6Y2FzZSAzODpjYXNlIDM5OmNhc2UgNDA6cmV0dXJuITB9cmV0dXJuITF9dmFyIHQ9XCJtbWVudVwiLGk9XCJzZWFyY2hmaWVsZFwiO2VbdF0uYWRkb25zW2ldPXtzZXR1cDpmdW5jdGlvbigpe3ZhciBsPXRoaXMsZD10aGlzLm9wdHNbaV0sYz10aGlzLmNvbmZbaV07cj1lW3RdLmdsYmwsXCJib29sZWFuXCI9PXR5cGVvZiBkJiYoZD17YWRkOmR9KSxcIm9iamVjdFwiIT10eXBlb2YgZCYmKGQ9e30pLFwiYm9vbGVhblwiPT10eXBlb2YgZC5yZXN1bHRzUGFuZWwmJihkLnJlc3VsdHNQYW5lbD17YWRkOmQucmVzdWx0c1BhbmVsfSksZD10aGlzLm9wdHNbaV09ZS5leHRlbmQoITAse30sZVt0XS5kZWZhdWx0c1tpXSxkKSxjPXRoaXMuY29uZltpXT1lLmV4dGVuZCghMCx7fSxlW3RdLmNvbmZpZ3VyYXRpb25baV0sYyksdGhpcy5iaW5kKFwiY2xvc2VcIixmdW5jdGlvbigpe3RoaXMuJG1lbnUuZmluZChcIi5cIitzLnNlYXJjaCkuZmluZChcImlucHV0XCIpLmJsdXIoKX0pLHRoaXMuYmluZChcImluaXRQYW5lbHNcIixmdW5jdGlvbihyKXtpZihkLmFkZCl7dmFyIGg7c3dpdGNoKGQuYWRkVG8pe2Nhc2VcInBhbmVsc1wiOmg9cjticmVhaztkZWZhdWx0Omg9dGhpcy4kbWVudS5maW5kKGQuYWRkVG8pfWlmKGguZWFjaChmdW5jdGlvbigpe3ZhciBuPWUodGhpcyk7aWYoIW4uaXMoXCIuXCIrcy5wYW5lbCl8fCFuLmlzKFwiLlwiK3MudmVydGljYWwpKXtpZighbi5jaGlsZHJlbihcIi5cIitzLnNlYXJjaCkubGVuZ3RoKXt2YXIgaT1sLl9fdmFsdWVPckZuKGMuY2xlYXIsbiksYT1sLl9fdmFsdWVPckZuKGMuZm9ybSxuKSxyPWwuX192YWx1ZU9yRm4oYy5pbnB1dCxuKSxoPWwuX192YWx1ZU9yRm4oYy5zdWJtaXQsbiksdT1lKFwiPFwiKyhhP1wiZm9ybVwiOlwiZGl2XCIpKycgY2xhc3M9XCInK3Muc2VhcmNoKydcIiAvPicpLGY9ZSgnPGlucHV0IHBsYWNlaG9sZGVyPVwiJytlW3RdLmkxOG4oZC5wbGFjZWhvbGRlcikrJ1wiIHR5cGU9XCJ0ZXh0XCIgYXV0b2NvbXBsZXRlPVwib2ZmXCIgLz4nKTt1LmFwcGVuZChmKTt2YXIgcDtpZihyKWZvcihwIGluIHIpZi5hdHRyKHAscltwXSk7aWYoaSYmZSgnPGEgY2xhc3M9XCInK3MuYnRuK1wiIFwiK3MuY2xlYXIrJ1wiIGhyZWY9XCIjXCIgLz4nKS5hcHBlbmRUbyh1KS5vbihvLmNsaWNrK1wiLXNlYXJjaGZpZWxkXCIsZnVuY3Rpb24oZSl7ZS5wcmV2ZW50RGVmYXVsdCgpLGYudmFsKFwiXCIpLnRyaWdnZXIoby5rZXl1cCtcIi1zZWFyY2hmaWVsZFwiKX0pLGEpe2ZvcihwIGluIGEpdS5hdHRyKHAsYVtwXSk7aCYmIWkmJmUoJzxhIGNsYXNzPVwiJytzLmJ0bitcIiBcIitzLm5leHQrJ1wiIGhyZWY9XCIjXCIgLz4nKS5hcHBlbmRUbyh1KS5vbihvLmNsaWNrK1wiLXNlYXJjaGZpZWxkXCIsZnVuY3Rpb24oZSl7ZS5wcmV2ZW50RGVmYXVsdCgpLHUuc3VibWl0KCl9KX1uLmhhc0NsYXNzKHMuc2VhcmNoKT9uLnJlcGxhY2VXaXRoKHUpOm4ucHJlcGVuZCh1KS5hZGRDbGFzcyhzLmhhc3NlYXJjaCl9aWYoZC5ub1Jlc3VsdHMpe3ZhciB2PW4uY2xvc2VzdChcIi5cIitzLnBhbmVsKS5sZW5ndGg7aWYodnx8KG49bC4kcG5scy5jaGlsZHJlbihcIi5cIitzLnBhbmVsKS5maXJzdCgpKSwhbi5jaGlsZHJlbihcIi5cIitzLm5vcmVzdWx0c21zZykubGVuZ3RoKXt2YXIgbT1uLmNoaWxkcmVuKFwiLlwiK3MubGlzdHZpZXcpLmZpcnN0KCk7ZSgnPGRpdiBjbGFzcz1cIicrcy5ub3Jlc3VsdHNtc2crXCIgXCIrcy5oaWRkZW4rJ1wiIC8+JykuYXBwZW5kKGVbdF0uaTE4bihkLm5vUmVzdWx0cykpW20ubGVuZ3RoP1wiaW5zZXJ0QWZ0ZXJcIjpcInByZXBlbmRUb1wiXShtLmxlbmd0aD9tOm4pfX19fSksZC5zZWFyY2gpe2lmKGQucmVzdWx0c1BhbmVsLmFkZCl7ZC5zaG93U3ViUGFuZWxzPSExO3ZhciB1PXRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIrcy5yZXN1bHRzcGFuZWwpO3UubGVuZ3RofHwodT1lKCc8ZGl2IGNsYXNzPVwiJytzLnBhbmVsK1wiIFwiK3MucmVzdWx0c3BhbmVsK1wiIFwiK3MuaGlkZGVuKydcIiAvPicpLmFwcGVuZFRvKHRoaXMuJHBubHMpLmFwcGVuZCgnPGRpdiBjbGFzcz1cIicrcy5uYXZiYXIrXCIgXCIrcy5oaWRkZW4rJ1wiPjxhIGNsYXNzPVwiJytzLnRpdGxlKydcIj4nK2VbdF0uaTE4bihkLnJlc3VsdHNQYW5lbC50aXRsZSkrXCI8L2E+PC9kaXY+XCIpLmFwcGVuZCgnPHVsIGNsYXNzPVwiJytzLmxpc3R2aWV3KydcIiAvPicpLmFwcGVuZCh0aGlzLiRwbmxzLmZpbmQoXCIuXCIrcy5ub3Jlc3VsdHNtc2cpLmZpcnN0KCkuY2xvbmUoKSksdGhpcy5pbml0UGFuZWxzKHUpKX10aGlzLiRtZW51LmZpbmQoXCIuXCIrcy5zZWFyY2gpLmVhY2goZnVuY3Rpb24oKXt2YXIgdCxyLGM9ZSh0aGlzKSxoPWMuY2xvc2VzdChcIi5cIitzLnBhbmVsKS5sZW5ndGg7aD8odD1jLmNsb3Nlc3QoXCIuXCIrcy5wYW5lbCkscj10KToodD1lKFwiLlwiK3MucGFuZWwsbC4kbWVudSkscj1sLiRtZW51KSxkLnJlc3VsdHNQYW5lbC5hZGQmJih0PXQubm90KHUpKTt2YXIgZj1jLmNoaWxkcmVuKFwiaW5wdXRcIikscD1sLl9fZmluZEFkZEJhY2sodCxcIi5cIitzLmxpc3R2aWV3KS5jaGlsZHJlbihcImxpXCIpLHY9cC5maWx0ZXIoXCIuXCIrcy5kaXZpZGVyKSxtPWwuX19maWx0ZXJMaXN0SXRlbXMocCksZz1cImFcIixiPWcrXCIsIHNwYW5cIixfPVwiXCIsQz1mdW5jdGlvbigpe3ZhciBuPWYudmFsKCkudG9Mb3dlckNhc2UoKTtpZihuIT1fKXtpZihfPW4sZC5yZXN1bHRzUGFuZWwuYWRkJiZ1LmNoaWxkcmVuKFwiLlwiK3MubGlzdHZpZXcpLmVtcHR5KCksdC5zY3JvbGxUb3AoMCksbS5hZGQodikuYWRkQ2xhc3Mocy5oaWRkZW4pLmZpbmQoXCIuXCIrcy5mdWxsc3Vib3BlbnNlYXJjaCkucmVtb3ZlQ2xhc3Mocy5mdWxsc3Vib3BlbitcIiBcIitzLmZ1bGxzdWJvcGVuc2VhcmNoKSxtLmVhY2goZnVuY3Rpb24oKXt2YXIgbj1lKHRoaXMpLHQ9ZzsoZC5zaG93VGV4dEl0ZW1zfHxkLnNob3dTdWJQYW5lbHMmJm4uZmluZChcIi5cIitzLm5leHQpKSYmKHQ9Yik7dmFyIGk9bi5kYXRhKGEuc2VhcmNodGV4dCl8fG4uY2hpbGRyZW4odCkudGV4dCgpO2kudG9Mb3dlckNhc2UoKS5pbmRleE9mKF8pPi0xJiZuLmFkZChuLnByZXZBbGwoXCIuXCIrcy5kaXZpZGVyKS5maXJzdCgpKS5yZW1vdmVDbGFzcyhzLmhpZGRlbil9KSxkLnNob3dTdWJQYW5lbHMmJnQuZWFjaChmdW5jdGlvbihuKXt2YXIgdD1lKHRoaXMpO2wuX19maWx0ZXJMaXN0SXRlbXModC5maW5kKFwiLlwiK3MubGlzdHZpZXcpLmNoaWxkcmVuKCkpLmVhY2goZnVuY3Rpb24oKXt2YXIgbj1lKHRoaXMpLHQ9bi5kYXRhKGEuY2hpbGQpO24ucmVtb3ZlQ2xhc3Mocy5ub3N1YnJlc3VsdHMpLHQmJnQuZmluZChcIi5cIitzLmxpc3R2aWV3KS5jaGlsZHJlbigpLnJlbW92ZUNsYXNzKHMuaGlkZGVuKX0pfSksZC5yZXN1bHRzUGFuZWwuYWRkKWlmKFwiXCI9PT1fKXRoaXMuY2xvc2VBbGxQYW5lbHMoKSx0aGlzLm9wZW5QYW5lbCh0aGlzLiRwbmxzLmNoaWxkcmVuKFwiLlwiK3Muc3Vib3BlbmVkKS5sYXN0KCkpO2Vsc2V7dmFyIGk9ZSgpO3QuZWFjaChmdW5jdGlvbigpe3ZhciBuPWwuX19maWx0ZXJMaXN0SXRlbXMoZSh0aGlzKS5maW5kKFwiLlwiK3MubGlzdHZpZXcpLmNoaWxkcmVuKCkpLm5vdChcIi5cIitzLmhpZGRlbikuY2xvbmUoITApO24ubGVuZ3RoJiYoZC5yZXN1bHRzUGFuZWwuZGl2aWRlcnMmJihpPWkuYWRkKCc8bGkgY2xhc3M9XCInK3MuZGl2aWRlcisnXCI+JytlKHRoaXMpLmNoaWxkcmVuKFwiLlwiK3MubmF2YmFyKS50ZXh0KCkrXCI8L2xpPlwiKSksaT1pLmFkZChuKSl9KSxpLmZpbmQoXCIuXCIrcy5uZXh0KS5yZW1vdmUoKSx1LmNoaWxkcmVuKFwiLlwiK3MubGlzdHZpZXcpLmFwcGVuZChpKSx0aGlzLm9wZW5QYW5lbCh1KX1lbHNlIGUodC5nZXQoKS5yZXZlcnNlKCkpLmVhY2goZnVuY3Rpb24obil7dmFyIHQ9ZSh0aGlzKSxpPXQuZGF0YShhLnBhcmVudCk7aSYmKGwuX19maWx0ZXJMaXN0SXRlbXModC5maW5kKFwiLlwiK3MubGlzdHZpZXcpLmNoaWxkcmVuKCkpLmxlbmd0aD8oaS5oYXNDbGFzcyhzLmhpZGRlbikmJmkuY2hpbGRyZW4oXCIuXCIrcy5uZXh0KS5ub3QoXCIuXCIrcy5mdWxsc3Vib3BlbikuYWRkQ2xhc3Mocy5mdWxsc3Vib3BlbikuYWRkQ2xhc3Mocy5mdWxsc3Vib3BlbnNlYXJjaCksaS5yZW1vdmVDbGFzcyhzLmhpZGRlbikucmVtb3ZlQ2xhc3Mocy5ub3N1YnJlc3VsdHMpLnByZXZBbGwoXCIuXCIrcy5kaXZpZGVyKS5maXJzdCgpLnJlbW92ZUNsYXNzKHMuaGlkZGVuKSk6aHx8KHQuaGFzQ2xhc3Mocy5vcGVuZWQpJiZzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7bC5vcGVuUGFuZWwoaS5jbG9zZXN0KFwiLlwiK3MucGFuZWwpKX0sKG4rMSkqKDEuNSpsLmNvbmYub3BlbmluZ0ludGVydmFsKSksaS5hZGRDbGFzcyhzLm5vc3VicmVzdWx0cykpKX0pO3IuZmluZChcIi5cIitzLm5vcmVzdWx0c21zZylbbS5ub3QoXCIuXCIrcy5oaWRkZW4pLmxlbmd0aD9cImFkZENsYXNzXCI6XCJyZW1vdmVDbGFzc1wiXShzLmhpZGRlbiksdGhpcy51cGRhdGUoKX19O2Yub2ZmKG8ua2V5dXArXCItXCIraStcIiBcIitvLmNoYW5nZStcIi1cIitpKS5vbihvLmtleXVwK1wiLVwiK2ksZnVuY3Rpb24oZSl7bihlLmtleUNvZGUpfHxDLmNhbGwobCl9KS5vbihvLmNoYW5nZStcIi1cIitpLGZ1bmN0aW9uKGUpe0MuY2FsbChsKX0pO3ZhciB5PWMuY2hpbGRyZW4oXCIuXCIrcy5idG4pO3kubGVuZ3RoJiZmLm9uKG8ua2V5dXArXCItXCIraSxmdW5jdGlvbihlKXt5W2YudmFsKCkubGVuZ3RoP1wicmVtb3ZlQ2xhc3NcIjpcImFkZENsYXNzXCJdKHMuaGlkZGVuKX0pLGYudHJpZ2dlcihvLmtleXVwK1wiLVwiK2kpfSl9fX0pfSxhZGQ6ZnVuY3Rpb24oKXtzPWVbdF0uX2MsYT1lW3RdLl9kLG89ZVt0XS5fZSxzLmFkZChcImNsZWFyIHNlYXJjaCBoYXNzZWFyY2ggcmVzdWx0c3BhbmVsIG5vcmVzdWx0c21zZyBub3Jlc3VsdHMgbm9zdWJyZXN1bHRzIGZ1bGxzdWJvcGVuc2VhcmNoXCIpLGEuYWRkKFwic2VhcmNodGV4dFwiKSxvLmFkZChcImNoYW5nZSBrZXl1cFwiKX0sY2xpY2tBbmNob3I6ZnVuY3Rpb24oZSxuKXt9fSxlW3RdLmRlZmF1bHRzW2ldPXthZGQ6ITEsYWRkVG86XCJwYW5lbHNcIixwbGFjZWhvbGRlcjpcIlNlYXJjaFwiLG5vUmVzdWx0czpcIk5vIHJlc3VsdHMgZm91bmQuXCIscmVzdWx0c1BhbmVsOnthZGQ6ITEsZGl2aWRlcnM6ITAsdGl0bGU6XCJTZWFyY2ggcmVzdWx0c1wifSxzZWFyY2g6ITAsc2hvd1RleHRJdGVtczohMSxzaG93U3ViUGFuZWxzOiEwfSxlW3RdLmNvbmZpZ3VyYXRpb25baV09e2NsZWFyOiExLGZvcm06ITEsaW5wdXQ6ITEsc3VibWl0OiExfTt2YXIgcyxhLG8scn0oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgc2VjdGlvbkluZGV4ZXIgYWRkLW9uXG4gKiBtbWVudS5mcmVic2l0ZS5ubFxuICpcbiAqIENvcHlyaWdodCAoYykgRnJlZCBIZXVzc2NoZW5cbiAqL1xuZnVuY3Rpb24oZSl7dmFyIG49XCJtbWVudVwiLHQ9XCJzZWN0aW9uSW5kZXhlclwiO2Vbbl0uYWRkb25zW3RdPXtzZXR1cDpmdW5jdGlvbigpe3ZhciBzPXRoaXMscj10aGlzLm9wdHNbdF07dGhpcy5jb25mW3RdO289ZVtuXS5nbGJsLFwiYm9vbGVhblwiPT10eXBlb2YgciYmKHI9e2FkZDpyfSksXCJvYmplY3RcIiE9dHlwZW9mIHImJihyPXt9KSxyPXRoaXMub3B0c1t0XT1lLmV4dGVuZCghMCx7fSxlW25dLmRlZmF1bHRzW3RdLHIpLHRoaXMuYmluZChcImluaXRQYW5lbHNcIixmdW5jdGlvbihuKXtpZihyLmFkZCl7dmFyIHQ7c3dpdGNoKHIuYWRkVG8pe2Nhc2VcInBhbmVsc1wiOnQ9bjticmVhaztkZWZhdWx0OnQ9ZShyLmFkZFRvLHRoaXMuJG1lbnUpLmZpbHRlcihcIi5cIitpLnBhbmVsKX10LmZpbmQoXCIuXCIraS5kaXZpZGVyKS5jbG9zZXN0KFwiLlwiK2kucGFuZWwpLmFkZENsYXNzKGkuaGFzaW5kZXhlcil9aWYoIXRoaXMuJGluZGV4ZXImJnRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIraS5oYXNpbmRleGVyKS5sZW5ndGgpe3RoaXMuJGluZGV4ZXI9ZSgnPGRpdiBjbGFzcz1cIicraS5pbmRleGVyKydcIiAvPicpLnByZXBlbmRUbyh0aGlzLiRwbmxzKS5hcHBlbmQoJzxhIGhyZWY9XCIjYVwiPmE8L2E+PGEgaHJlZj1cIiNiXCI+YjwvYT48YSBocmVmPVwiI2NcIj5jPC9hPjxhIGhyZWY9XCIjZFwiPmQ8L2E+PGEgaHJlZj1cIiNlXCI+ZTwvYT48YSBocmVmPVwiI2ZcIj5mPC9hPjxhIGhyZWY9XCIjZ1wiPmc8L2E+PGEgaHJlZj1cIiNoXCI+aDwvYT48YSBocmVmPVwiI2lcIj5pPC9hPjxhIGhyZWY9XCIjalwiPmo8L2E+PGEgaHJlZj1cIiNrXCI+azwvYT48YSBocmVmPVwiI2xcIj5sPC9hPjxhIGhyZWY9XCIjbVwiPm08L2E+PGEgaHJlZj1cIiNuXCI+bjwvYT48YSBocmVmPVwiI29cIj5vPC9hPjxhIGhyZWY9XCIjcFwiPnA8L2E+PGEgaHJlZj1cIiNxXCI+cTwvYT48YSBocmVmPVwiI3JcIj5yPC9hPjxhIGhyZWY9XCIjc1wiPnM8L2E+PGEgaHJlZj1cIiN0XCI+dDwvYT48YSBocmVmPVwiI3VcIj51PC9hPjxhIGhyZWY9XCIjdlwiPnY8L2E+PGEgaHJlZj1cIiN3XCI+dzwvYT48YSBocmVmPVwiI3hcIj54PC9hPjxhIGhyZWY9XCIjeVwiPnk8L2E+PGEgaHJlZj1cIiN6XCI+ejwvYT4nKSx0aGlzLiRpbmRleGVyLmNoaWxkcmVuKCkub24oYS5tb3VzZW92ZXIrXCItc2VjdGlvbmluZGV4ZXIgXCIraS50b3VjaHN0YXJ0K1wiLXNlY3Rpb25pbmRleGVyXCIsZnVuY3Rpb24obil7dmFyIHQ9ZSh0aGlzKS5hdHRyKFwiaHJlZlwiKS5zbGljZSgxKSxhPXMuJHBubHMuY2hpbGRyZW4oXCIuXCIraS5jdXJyZW50KSxvPWEuZmluZChcIi5cIitpLmxpc3R2aWV3KSxyPSExLGw9YS5zY3JvbGxUb3AoKTthLnNjcm9sbFRvcCgwKSxvLmNoaWxkcmVuKFwiLlwiK2kuZGl2aWRlcikubm90KFwiLlwiK2kuaGlkZGVuKS5lYWNoKGZ1bmN0aW9uKCl7cj09PSExJiZ0PT1lKHRoaXMpLnRleHQoKS5zbGljZSgwLDEpLnRvTG93ZXJDYXNlKCkmJihyPWUodGhpcykucG9zaXRpb24oKS50b3ApfSksYS5zY3JvbGxUb3AociE9PSExP3I6bCl9KTt2YXIgbz1mdW5jdGlvbihlKXtzLiRtZW51WyhlLmhhc0NsYXNzKGkuaGFzaW5kZXhlcik/XCJhZGRcIjpcInJlbW92ZVwiKStcIkNsYXNzXCJdKGkuaGFzaW5kZXhlcil9O3RoaXMuYmluZChcIm9wZW5QYW5lbFwiLG8pLG8uY2FsbCh0aGlzLHRoaXMuJHBubHMuY2hpbGRyZW4oXCIuXCIraS5jdXJyZW50KSl9fSl9LGFkZDpmdW5jdGlvbigpe2k9ZVtuXS5fYyxzPWVbbl0uX2QsYT1lW25dLl9lLGkuYWRkKFwiaW5kZXhlciBoYXNpbmRleGVyXCIpLGEuYWRkKFwibW91c2VvdmVyIHRvdWNoc3RhcnRcIil9LGNsaWNrQW5jaG9yOmZ1bmN0aW9uKGUsbil7aWYoZS5wYXJlbnQoKS5pcyhcIi5cIitpLmluZGV4ZXIpKXJldHVybiEwfX0sZVtuXS5kZWZhdWx0c1t0XT17YWRkOiExLGFkZFRvOlwicGFuZWxzXCJ9O3ZhciBpLHMsYSxvfShqUXVlcnkpLC8qXHRcbiAqIGpRdWVyeSBtbWVudSBzZXRTZWxlY3RlZCBhZGQtb25cbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlxuICogQ29weXJpZ2h0IChjKSBGcmVkIEhldXNzY2hlblxuICovXG5mdW5jdGlvbihlKXt2YXIgbj1cIm1tZW51XCIsdD1cInNldFNlbGVjdGVkXCI7ZVtuXS5hZGRvbnNbdF09e3NldHVwOmZ1bmN0aW9uKCl7dmFyIGE9dGhpcyxyPXRoaXMub3B0c1t0XTt0aGlzLmNvbmZbdF07aWYobz1lW25dLmdsYmwsXCJib29sZWFuXCI9PXR5cGVvZiByJiYocj17aG92ZXI6cixwYXJlbnQ6cn0pLFwib2JqZWN0XCIhPXR5cGVvZiByJiYocj17fSkscj10aGlzLm9wdHNbdF09ZS5leHRlbmQoITAse30sZVtuXS5kZWZhdWx0c1t0XSxyKSxcImRldGVjdFwiPT1yLmN1cnJlbnQpe3ZhciBsPWZ1bmN0aW9uKGUpe2U9ZS5zcGxpdChcIj9cIilbMF0uc3BsaXQoXCIjXCIpWzBdO3ZhciBuPWEuJG1lbnUuZmluZCgnYVtocmVmPVwiJytlKydcIl0sIGFbaHJlZj1cIicrZSsnL1wiXScpO24ubGVuZ3RoP2Euc2V0U2VsZWN0ZWQobi5wYXJlbnQoKSwhMCk6KGU9ZS5zcGxpdChcIi9cIikuc2xpY2UoMCwtMSksZS5sZW5ndGgmJmwoZS5qb2luKFwiL1wiKSkpfTtsKHdpbmRvdy5sb2NhdGlvbi5ocmVmKX1lbHNlIHIuY3VycmVudHx8dGhpcy5iaW5kKFwiaW5pdFBhbmVsc1wiLGZ1bmN0aW9uKGUpe2UuZmluZChcIi5cIitpLmxpc3R2aWV3KS5jaGlsZHJlbihcIi5cIitpLnNlbGVjdGVkKS5yZW1vdmVDbGFzcyhpLnNlbGVjdGVkKX0pO2lmKHIuaG92ZXImJnRoaXMuJG1lbnUuYWRkQ2xhc3MoaS5ob3ZlcnNlbGVjdGVkKSxyLnBhcmVudCl7dGhpcy4kbWVudS5hZGRDbGFzcyhpLnBhcmVudHNlbGVjdGVkKTt2YXIgZD1mdW5jdGlvbihlKXt0aGlzLiRwbmxzLmZpbmQoXCIuXCIraS5saXN0dmlldykuZmluZChcIi5cIitpLm5leHQpLnJlbW92ZUNsYXNzKGkuc2VsZWN0ZWQpO2Zvcih2YXIgbj1lLmRhdGEocy5wYXJlbnQpO24mJm4ubGVuZ3RoOyluPW4ubm90KFwiLlwiK2kudmVydGljYWwpLmNoaWxkcmVuKFwiLlwiK2kubmV4dCkuYWRkQ2xhc3MoaS5zZWxlY3RlZCkuZW5kKCkuY2xvc2VzdChcIi5cIitpLnBhbmVsKS5kYXRhKHMucGFyZW50KX07dGhpcy5iaW5kKFwib3BlbmVkUGFuZWxcIixkKSx0aGlzLmJpbmQoXCJpbml0UGFuZWxzXCIsZnVuY3Rpb24oZSl7ZC5jYWxsKHRoaXMsdGhpcy4kcG5scy5jaGlsZHJlbihcIi5cIitpLmN1cnJlbnQpKX0pfX0sYWRkOmZ1bmN0aW9uKCl7aT1lW25dLl9jLHM9ZVtuXS5fZCxhPWVbbl0uX2UsaS5hZGQoXCJob3ZlcnNlbGVjdGVkIHBhcmVudHNlbGVjdGVkXCIpfSxjbGlja0FuY2hvcjpmdW5jdGlvbihlLG4pe319LGVbbl0uZGVmYXVsdHNbdF09e2N1cnJlbnQ6ITAsaG92ZXI6ITEscGFyZW50OiExfTt2YXIgaSxzLGEsb30oalF1ZXJ5KSwvKlx0XG4gKiBqUXVlcnkgbW1lbnUgdG9nZ2xlcyBhZGQtb25cbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlxuICogQ29weXJpZ2h0IChjKSBGcmVkIEhldXNzY2hlblxuICovXG5mdW5jdGlvbihlKXt2YXIgbj1cIm1tZW51XCIsdD1cInRvZ2dsZXNcIjtlW25dLmFkZG9uc1t0XT17c2V0dXA6ZnVuY3Rpb24oKXt2YXIgcz10aGlzO3RoaXMub3B0c1t0XSx0aGlzLmNvbmZbdF07bz1lW25dLmdsYmwsdGhpcy5iaW5kKFwiaW5pdFBhbmVsc1wiLGZ1bmN0aW9uKG4pe3RoaXMuX19yZWZhY3RvckNsYXNzKGUoXCJpbnB1dFwiLG4pLHRoaXMuY29uZi5jbGFzc05hbWVzW3RdLnRvZ2dsZSxcInRvZ2dsZVwiKSx0aGlzLl9fcmVmYWN0b3JDbGFzcyhlKFwiaW5wdXRcIixuKSx0aGlzLmNvbmYuY2xhc3NOYW1lc1t0XS5jaGVjayxcImNoZWNrXCIpLGUoXCJpbnB1dC5cIitpLnRvZ2dsZStcIiwgaW5wdXQuXCIraS5jaGVjayxuKS5lYWNoKGZ1bmN0aW9uKCl7dmFyIG49ZSh0aGlzKSx0PW4uY2xvc2VzdChcImxpXCIpLGE9bi5oYXNDbGFzcyhpLnRvZ2dsZSk/XCJ0b2dnbGVcIjpcImNoZWNrXCIsbz1uLmF0dHIoXCJpZFwiKXx8cy5fX2dldFVuaXF1ZUlkKCk7dC5jaGlsZHJlbignbGFiZWxbZm9yPVwiJytvKydcIl0nKS5sZW5ndGh8fChuLmF0dHIoXCJpZFwiLG8pLHQucHJlcGVuZChuKSxlKCc8bGFiZWwgZm9yPVwiJytvKydcIiBjbGFzcz1cIicraVthXSsnXCI+PC9sYWJlbD4nKS5pbnNlcnRCZWZvcmUodC5jaGlsZHJlbihcImEsIHNwYW5cIikubGFzdCgpKSl9KX0pfSxhZGQ6ZnVuY3Rpb24oKXtpPWVbbl0uX2Mscz1lW25dLl9kLGE9ZVtuXS5fZSxpLmFkZChcInRvZ2dsZSBjaGVja1wiKX0sY2xpY2tBbmNob3I6ZnVuY3Rpb24oZSxuKXt9fSxlW25dLmNvbmZpZ3VyYXRpb24uY2xhc3NOYW1lc1t0XT17dG9nZ2xlOlwiVG9nZ2xlXCIsY2hlY2s6XCJDaGVja1wifTt2YXIgaSxzLGEsb30oalF1ZXJ5KTsiLCIvKlx0XG4gKiBqUXVlcnkgbW1lbnUgZml4ZWRFbGVtZW50cyBhZGQtb25cbiAqIG1tZW51LmZyZWJzaXRlLm5sXG4gKlxuICogQ29weXJpZ2h0IChjKSBGcmVkIEhldXNzY2hlblxuICovXG4hZnVuY3Rpb24ocyl7dmFyIGk9XCJtbWVudVwiLHQ9XCJmaXhlZEVsZW1lbnRzXCI7c1tpXS5hZGRvbnNbdF09e3NldHVwOmZ1bmN0aW9uKCl7aWYodGhpcy5vcHRzLm9mZkNhbnZhcyl7dmFyIG49dGhpcy5vcHRzW3RdO3RoaXMuY29uZlt0XTtkPXNbaV0uZ2xibCxuPXRoaXMub3B0c1t0XT1zLmV4dGVuZCghMCx7fSxzW2ldLmRlZmF1bHRzW3RdLG4pO3ZhciBhPWZ1bmN0aW9uKHMpe3ZhciBpPXRoaXMuY29uZi5jbGFzc05hbWVzW3RdLmZpeGVkO3RoaXMuX19yZWZhY3RvckNsYXNzKHMuZmluZChcIi5cIitpKSxpLFwic2xpZGVvdXRcIikuYXBwZW5kVG8oZC4kYm9keSl9O2EuY2FsbCh0aGlzLGQuJHBhZ2UpLHRoaXMuYmluZChcInNldFBhZ2VcIixhKX19LGFkZDpmdW5jdGlvbigpe249c1tpXS5fYyxhPXNbaV0uX2QsZT1zW2ldLl9lLG4uYWRkKFwiZml4ZWRcIil9LGNsaWNrQW5jaG9yOmZ1bmN0aW9uKHMsaSl7fX0sc1tpXS5jb25maWd1cmF0aW9uLmNsYXNzTmFtZXNbdF09e2ZpeGVkOlwiRml4ZWRcIn07dmFyIG4sYSxlLGR9KGpRdWVyeSk7IiwiLyoqXG4qIGpxdWVyeS1tYXRjaC1oZWlnaHQgbWFzdGVyIGJ5IEBsaWFicnVcbiogaHR0cDovL2JybS5pby9qcXVlcnktbWF0Y2gtaGVpZ2h0L1xuKiBMaWNlbnNlOiBNSVRcbiovXG5cbjsoZnVuY3Rpb24oZmFjdG9yeSkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWV4dHJhLXNlbWlcbiAgICAndXNlIHN0cmljdCc7XG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICAvLyBBTURcbiAgICAgICAgZGVmaW5lKFsnanF1ZXJ5J10sIGZhY3RvcnkpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgICAgLy8gQ29tbW9uSlNcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJlcXVpcmUoJ2pxdWVyeScpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBHbG9iYWxcbiAgICAgICAgZmFjdG9yeShqUXVlcnkpO1xuICAgIH1cbn0pKGZ1bmN0aW9uKCQpIHtcbiAgICAvKlxuICAgICogIGludGVybmFsXG4gICAgKi9cblxuICAgIHZhciBfcHJldmlvdXNSZXNpemVXaWR0aCA9IC0xLFxuICAgICAgICBfdXBkYXRlVGltZW91dCA9IC0xO1xuXG4gICAgLypcbiAgICAqICBfcGFyc2VcbiAgICAqICB2YWx1ZSBwYXJzZSB1dGlsaXR5IGZ1bmN0aW9uXG4gICAgKi9cblxuICAgIHZhciBfcGFyc2UgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAvLyBwYXJzZSB2YWx1ZSBhbmQgY29udmVydCBOYU4gdG8gMFxuICAgICAgICByZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZSkgfHwgMDtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqICBfcm93c1xuICAgICogIHV0aWxpdHkgZnVuY3Rpb24gcmV0dXJucyBhcnJheSBvZiBqUXVlcnkgc2VsZWN0aW9ucyByZXByZXNlbnRpbmcgZWFjaCByb3dcbiAgICAqICAoYXMgZGlzcGxheWVkIGFmdGVyIGZsb2F0IHdyYXBwaW5nIGFwcGxpZWQgYnkgYnJvd3NlcilcbiAgICAqL1xuXG4gICAgdmFyIF9yb3dzID0gZnVuY3Rpb24oZWxlbWVudHMpIHtcbiAgICAgICAgdmFyIHRvbGVyYW5jZSA9IDEsXG4gICAgICAgICAgICAkZWxlbWVudHMgPSAkKGVsZW1lbnRzKSxcbiAgICAgICAgICAgIGxhc3RUb3AgPSBudWxsLFxuICAgICAgICAgICAgcm93cyA9IFtdO1xuXG4gICAgICAgIC8vIGdyb3VwIGVsZW1lbnRzIGJ5IHRoZWlyIHRvcCBwb3NpdGlvblxuICAgICAgICAkZWxlbWVudHMuZWFjaChmdW5jdGlvbigpe1xuICAgICAgICAgICAgdmFyICR0aGF0ID0gJCh0aGlzKSxcbiAgICAgICAgICAgICAgICB0b3AgPSAkdGhhdC5vZmZzZXQoKS50b3AgLSBfcGFyc2UoJHRoYXQuY3NzKCdtYXJnaW4tdG9wJykpLFxuICAgICAgICAgICAgICAgIGxhc3RSb3cgPSByb3dzLmxlbmd0aCA+IDAgPyByb3dzW3Jvd3MubGVuZ3RoIC0gMV0gOiBudWxsO1xuXG4gICAgICAgICAgICBpZiAobGFzdFJvdyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vIGZpcnN0IGl0ZW0gb24gdGhlIHJvdywgc28ganVzdCBwdXNoIGl0XG4gICAgICAgICAgICAgICAgcm93cy5wdXNoKCR0aGF0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlIHJvdyB0b3AgaXMgdGhlIHNhbWUsIGFkZCB0byB0aGUgcm93IGdyb3VwXG4gICAgICAgICAgICAgICAgaWYgKE1hdGguZmxvb3IoTWF0aC5hYnMobGFzdFRvcCAtIHRvcCkpIDw9IHRvbGVyYW5jZSkge1xuICAgICAgICAgICAgICAgICAgICByb3dzW3Jvd3MubGVuZ3RoIC0gMV0gPSBsYXN0Um93LmFkZCgkdGhhdCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIHN0YXJ0IGEgbmV3IHJvdyBncm91cFxuICAgICAgICAgICAgICAgICAgICByb3dzLnB1c2goJHRoYXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8ga2VlcCB0cmFjayBvZiB0aGUgbGFzdCByb3cgdG9wXG4gICAgICAgICAgICBsYXN0VG9wID0gdG9wO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcm93cztcbiAgICB9O1xuXG4gICAgLypcbiAgICAqICBfcGFyc2VPcHRpb25zXG4gICAgKiAgaGFuZGxlIHBsdWdpbiBvcHRpb25zXG4gICAgKi9cblxuICAgIHZhciBfcGFyc2VPcHRpb25zID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgb3B0cyA9IHtcbiAgICAgICAgICAgIGJ5Um93OiB0cnVlLFxuICAgICAgICAgICAgcHJvcGVydHk6ICdoZWlnaHQnLFxuICAgICAgICAgICAgdGFyZ2V0OiBudWxsLFxuICAgICAgICAgICAgcmVtb3ZlOiBmYWxzZVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiAkLmV4dGVuZChvcHRzLCBvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICBvcHRzLmJ5Um93ID0gb3B0aW9ucztcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zID09PSAncmVtb3ZlJykge1xuICAgICAgICAgICAgb3B0cy5yZW1vdmUgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG9wdHM7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiAgbWF0Y2hIZWlnaHRcbiAgICAqICBwbHVnaW4gZGVmaW5pdGlvblxuICAgICovXG5cbiAgICB2YXIgbWF0Y2hIZWlnaHQgPSAkLmZuLm1hdGNoSGVpZ2h0ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgICB2YXIgb3B0cyA9IF9wYXJzZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgLy8gaGFuZGxlIHJlbW92ZVxuICAgICAgICBpZiAob3B0cy5yZW1vdmUpIHtcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZpeGVkIGhlaWdodCBmcm9tIGFsbCBzZWxlY3RlZCBlbGVtZW50c1xuICAgICAgICAgICAgdGhpcy5jc3Mob3B0cy5wcm9wZXJ0eSwgJycpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgc2VsZWN0ZWQgZWxlbWVudHMgZnJvbSBhbGwgZ3JvdXBzXG4gICAgICAgICAgICAkLmVhY2gobWF0Y2hIZWlnaHQuX2dyb3VwcywgZnVuY3Rpb24oa2V5LCBncm91cCkge1xuICAgICAgICAgICAgICAgIGdyb3VwLmVsZW1lbnRzID0gZ3JvdXAuZWxlbWVudHMubm90KHRoYXQpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIFRPRE86IGNsZWFudXAgZW1wdHkgZ3JvdXBzXG5cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubGVuZ3RoIDw9IDEgJiYgIW9wdHMudGFyZ2V0KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGtlZXAgdHJhY2sgb2YgdGhpcyBncm91cCBzbyB3ZSBjYW4gcmUtYXBwbHkgbGF0ZXIgb24gbG9hZCBhbmQgcmVzaXplIGV2ZW50c1xuICAgICAgICBtYXRjaEhlaWdodC5fZ3JvdXBzLnB1c2goe1xuICAgICAgICAgICAgZWxlbWVudHM6IHRoaXMsXG4gICAgICAgICAgICBvcHRpb25zOiBvcHRzXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIG1hdGNoIGVhY2ggZWxlbWVudCdzIGhlaWdodCB0byB0aGUgdGFsbGVzdCBlbGVtZW50IGluIHRoZSBzZWxlY3Rpb25cbiAgICAgICAgbWF0Y2hIZWlnaHQuX2FwcGx5KHRoaXMsIG9wdHMpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogIHBsdWdpbiBnbG9iYWwgb3B0aW9uc1xuICAgICovXG5cbiAgICBtYXRjaEhlaWdodC52ZXJzaW9uID0gJ21hc3Rlcic7XG4gICAgbWF0Y2hIZWlnaHQuX2dyb3VwcyA9IFtdO1xuICAgIG1hdGNoSGVpZ2h0Ll90aHJvdHRsZSA9IDgwO1xuICAgIG1hdGNoSGVpZ2h0Ll9tYWludGFpblNjcm9sbCA9IGZhbHNlO1xuICAgIG1hdGNoSGVpZ2h0Ll9iZWZvcmVVcGRhdGUgPSBudWxsO1xuICAgIG1hdGNoSGVpZ2h0Ll9hZnRlclVwZGF0ZSA9IG51bGw7XG4gICAgbWF0Y2hIZWlnaHQuX3Jvd3MgPSBfcm93cztcbiAgICBtYXRjaEhlaWdodC5fcGFyc2UgPSBfcGFyc2U7XG4gICAgbWF0Y2hIZWlnaHQuX3BhcnNlT3B0aW9ucyA9IF9wYXJzZU9wdGlvbnM7XG5cbiAgICAvKlxuICAgICogIG1hdGNoSGVpZ2h0Ll9hcHBseVxuICAgICogIGFwcGx5IG1hdGNoSGVpZ2h0IHRvIGdpdmVuIGVsZW1lbnRzXG4gICAgKi9cblxuICAgIG1hdGNoSGVpZ2h0Ll9hcHBseSA9IGZ1bmN0aW9uKGVsZW1lbnRzLCBvcHRpb25zKSB7XG4gICAgICAgIHZhciBvcHRzID0gX3BhcnNlT3B0aW9ucyhvcHRpb25zKSxcbiAgICAgICAgICAgICRlbGVtZW50cyA9ICQoZWxlbWVudHMpLFxuICAgICAgICAgICAgcm93cyA9IFskZWxlbWVudHNdO1xuXG4gICAgICAgIC8vIHRha2Ugbm90ZSBvZiBzY3JvbGwgcG9zaXRpb25cbiAgICAgICAgdmFyIHNjcm9sbFRvcCA9ICQod2luZG93KS5zY3JvbGxUb3AoKSxcbiAgICAgICAgICAgIGh0bWxIZWlnaHQgPSAkKCdodG1sJykub3V0ZXJIZWlnaHQodHJ1ZSk7XG5cbiAgICAgICAgLy8gZ2V0IGhpZGRlbiBwYXJlbnRzXG4gICAgICAgIHZhciAkaGlkZGVuUGFyZW50cyA9ICRlbGVtZW50cy5wYXJlbnRzKCkuZmlsdGVyKCc6aGlkZGVuJyk7XG5cbiAgICAgICAgLy8gY2FjaGUgdGhlIG9yaWdpbmFsIGlubGluZSBzdHlsZVxuICAgICAgICAkaGlkZGVuUGFyZW50cy5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyICR0aGF0ID0gJCh0aGlzKTtcbiAgICAgICAgICAgICR0aGF0LmRhdGEoJ3N0eWxlLWNhY2hlJywgJHRoYXQuYXR0cignc3R5bGUnKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHRlbXBvcmFyaWx5IG11c3QgZm9yY2UgaGlkZGVuIHBhcmVudHMgdmlzaWJsZVxuICAgICAgICAkaGlkZGVuUGFyZW50cy5jc3MoJ2Rpc3BsYXknLCAnYmxvY2snKTtcblxuICAgICAgICAvLyBnZXQgcm93cyBpZiB1c2luZyBieVJvdywgb3RoZXJ3aXNlIGFzc3VtZSBvbmUgcm93XG4gICAgICAgIGlmIChvcHRzLmJ5Um93ICYmICFvcHRzLnRhcmdldCkge1xuXG4gICAgICAgICAgICAvLyBtdXN0IGZpcnN0IGZvcmNlIGFuIGFyYml0cmFyeSBlcXVhbCBoZWlnaHQgc28gZmxvYXRpbmcgZWxlbWVudHMgYnJlYWsgZXZlbmx5XG4gICAgICAgICAgICAkZWxlbWVudHMuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB2YXIgJHRoYXQgPSAkKHRoaXMpLFxuICAgICAgICAgICAgICAgICAgICBkaXNwbGF5ID0gJHRoYXQuY3NzKCdkaXNwbGF5Jyk7XG5cbiAgICAgICAgICAgICAgICAvLyB0ZW1wb3JhcmlseSBmb3JjZSBhIHVzYWJsZSBkaXNwbGF5IHZhbHVlXG4gICAgICAgICAgICAgICAgaWYgKGRpc3BsYXkgIT09ICdpbmxpbmUtYmxvY2snICYmIGRpc3BsYXkgIT09ICdmbGV4JyAmJiBkaXNwbGF5ICE9PSAnaW5saW5lLWZsZXgnKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGNhY2hlIHRoZSBvcmlnaW5hbCBpbmxpbmUgc3R5bGVcbiAgICAgICAgICAgICAgICAkdGhhdC5kYXRhKCdzdHlsZS1jYWNoZScsICR0aGF0LmF0dHIoJ3N0eWxlJykpO1xuXG4gICAgICAgICAgICAgICAgJHRoYXQuY3NzKHtcbiAgICAgICAgICAgICAgICAgICAgJ2Rpc3BsYXknOiBkaXNwbGF5LFxuICAgICAgICAgICAgICAgICAgICAncGFkZGluZy10b3AnOiAnMCcsXG4gICAgICAgICAgICAgICAgICAgICdwYWRkaW5nLWJvdHRvbSc6ICcwJyxcbiAgICAgICAgICAgICAgICAgICAgJ21hcmdpbi10b3AnOiAnMCcsXG4gICAgICAgICAgICAgICAgICAgICdtYXJnaW4tYm90dG9tJzogJzAnLFxuICAgICAgICAgICAgICAgICAgICAnYm9yZGVyLXRvcC13aWR0aCc6ICcwJyxcbiAgICAgICAgICAgICAgICAgICAgJ2JvcmRlci1ib3R0b20td2lkdGgnOiAnMCcsXG4gICAgICAgICAgICAgICAgICAgICdoZWlnaHQnOiAnMTAwcHgnLFxuICAgICAgICAgICAgICAgICAgICAnb3ZlcmZsb3cnOiAnaGlkZGVuJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGdldCB0aGUgYXJyYXkgb2Ygcm93cyAoYmFzZWQgb24gZWxlbWVudCB0b3AgcG9zaXRpb24pXG4gICAgICAgICAgICByb3dzID0gX3Jvd3MoJGVsZW1lbnRzKTtcblxuICAgICAgICAgICAgLy8gcmV2ZXJ0IG9yaWdpbmFsIGlubGluZSBzdHlsZXNcbiAgICAgICAgICAgICRlbGVtZW50cy5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciAkdGhhdCA9ICQodGhpcyk7XG4gICAgICAgICAgICAgICAgJHRoYXQuYXR0cignc3R5bGUnLCAkdGhhdC5kYXRhKCdzdHlsZS1jYWNoZScpIHx8ICcnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgJC5lYWNoKHJvd3MsIGZ1bmN0aW9uKGtleSwgcm93KSB7XG4gICAgICAgICAgICB2YXIgJHJvdyA9ICQocm93KSxcbiAgICAgICAgICAgICAgICB0YXJnZXRIZWlnaHQgPSAwO1xuXG4gICAgICAgICAgICBpZiAoIW9wdHMudGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgLy8gc2tpcCBhcHBseSB0byByb3dzIHdpdGggb25seSBvbmUgaXRlbVxuICAgICAgICAgICAgICAgIGlmIChvcHRzLmJ5Um93ICYmICRyb3cubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgJHJvdy5jc3Mob3B0cy5wcm9wZXJ0eSwgJycpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaXRlcmF0ZSB0aGUgcm93IGFuZCBmaW5kIHRoZSBtYXggaGVpZ2h0XG4gICAgICAgICAgICAgICAgJHJvdy5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgIHZhciAkdGhhdCA9ICQodGhpcyksXG4gICAgICAgICAgICAgICAgICAgICAgICBzdHlsZSA9ICR0aGF0LmF0dHIoJ3N0eWxlJyksXG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNwbGF5ID0gJHRoYXQuY3NzKCdkaXNwbGF5Jyk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdGVtcG9yYXJpbHkgZm9yY2UgYSB1c2FibGUgZGlzcGxheSB2YWx1ZVxuICAgICAgICAgICAgICAgICAgICBpZiAoZGlzcGxheSAhPT0gJ2lubGluZS1ibG9jaycgJiYgZGlzcGxheSAhPT0gJ2ZsZXgnICYmIGRpc3BsYXkgIT09ICdpbmxpbmUtZmxleCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZW5zdXJlIHdlIGdldCB0aGUgY29ycmVjdCBhY3R1YWwgaGVpZ2h0IChhbmQgbm90IGEgcHJldmlvdXNseSBzZXQgaGVpZ2h0IHZhbHVlKVxuICAgICAgICAgICAgICAgICAgICB2YXIgY3NzID0geyAnZGlzcGxheSc6IGRpc3BsYXkgfTtcbiAgICAgICAgICAgICAgICAgICAgY3NzW29wdHMucHJvcGVydHldID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICR0aGF0LmNzcyhjc3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZpbmQgdGhlIG1heCBoZWlnaHQgKGluY2x1ZGluZyBwYWRkaW5nLCBidXQgbm90IG1hcmdpbilcbiAgICAgICAgICAgICAgICAgICAgaWYgKCR0aGF0Lm91dGVySGVpZ2h0KGZhbHNlKSA+IHRhcmdldEhlaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0SGVpZ2h0ID0gJHRoYXQub3V0ZXJIZWlnaHQoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmV2ZXJ0IHN0eWxlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoc3R5bGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICR0aGF0LmF0dHIoJ3N0eWxlJywgc3R5bGUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgJHRoYXQuY3NzKCdkaXNwbGF5JywgJycpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGlmIHRhcmdldCBzZXQsIHVzZSB0aGUgaGVpZ2h0IG9mIHRoZSB0YXJnZXQgZWxlbWVudFxuICAgICAgICAgICAgICAgIHRhcmdldEhlaWdodCA9IG9wdHMudGFyZ2V0Lm91dGVySGVpZ2h0KGZhbHNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaXRlcmF0ZSB0aGUgcm93IGFuZCBhcHBseSB0aGUgaGVpZ2h0IHRvIGFsbCBlbGVtZW50c1xuICAgICAgICAgICAgJHJvdy5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgdmFyICR0aGF0ID0gJCh0aGlzKSxcbiAgICAgICAgICAgICAgICAgICAgdmVydGljYWxQYWRkaW5nID0gMDtcblxuICAgICAgICAgICAgICAgIC8vIGRvbid0IGFwcGx5IHRvIGEgdGFyZ2V0XG4gICAgICAgICAgICAgICAgaWYgKG9wdHMudGFyZ2V0ICYmICR0aGF0LmlzKG9wdHMudGFyZ2V0KSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaGFuZGxlIHBhZGRpbmcgYW5kIGJvcmRlciBjb3JyZWN0bHkgKHJlcXVpcmVkIHdoZW4gbm90IHVzaW5nIGJvcmRlci1ib3gpXG4gICAgICAgICAgICAgICAgaWYgKCR0aGF0LmNzcygnYm94LXNpemluZycpICE9PSAnYm9yZGVyLWJveCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdmVydGljYWxQYWRkaW5nICs9IF9wYXJzZSgkdGhhdC5jc3MoJ2JvcmRlci10b3Atd2lkdGgnKSkgKyBfcGFyc2UoJHRoYXQuY3NzKCdib3JkZXItYm90dG9tLXdpZHRoJykpO1xuICAgICAgICAgICAgICAgICAgICB2ZXJ0aWNhbFBhZGRpbmcgKz0gX3BhcnNlKCR0aGF0LmNzcygncGFkZGluZy10b3AnKSkgKyBfcGFyc2UoJHRoYXQuY3NzKCdwYWRkaW5nLWJvdHRvbScpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIGhlaWdodCAoYWNjb3VudGluZyBmb3IgcGFkZGluZyBhbmQgYm9yZGVyKVxuICAgICAgICAgICAgICAgICR0aGF0LmNzcyhvcHRzLnByb3BlcnR5LCAodGFyZ2V0SGVpZ2h0IC0gdmVydGljYWxQYWRkaW5nKSArICdweCcpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHJldmVydCBoaWRkZW4gcGFyZW50c1xuICAgICAgICAkaGlkZGVuUGFyZW50cy5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyICR0aGF0ID0gJCh0aGlzKTtcbiAgICAgICAgICAgICR0aGF0LmF0dHIoJ3N0eWxlJywgJHRoYXQuZGF0YSgnc3R5bGUtY2FjaGUnKSB8fCBudWxsKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gcmVzdG9yZSBzY3JvbGwgcG9zaXRpb24gaWYgZW5hYmxlZFxuICAgICAgICBpZiAobWF0Y2hIZWlnaHQuX21haW50YWluU2Nyb2xsKSB7XG4gICAgICAgICAgICAkKHdpbmRvdykuc2Nyb2xsVG9wKChzY3JvbGxUb3AgLyBodG1sSGVpZ2h0KSAqICQoJ2h0bWwnKS5vdXRlckhlaWdodCh0cnVlKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLypcbiAgICAqICBtYXRjaEhlaWdodC5fYXBwbHlEYXRhQXBpXG4gICAgKiAgYXBwbGllcyBtYXRjaEhlaWdodCB0byBhbGwgZWxlbWVudHMgd2l0aCBhIGRhdGEtbWF0Y2gtaGVpZ2h0IGF0dHJpYnV0ZVxuICAgICovXG5cbiAgICBtYXRjaEhlaWdodC5fYXBwbHlEYXRhQXBpID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBncm91cHMgPSB7fTtcblxuICAgICAgICAvLyBnZW5lcmF0ZSBncm91cHMgYnkgdGhlaXIgZ3JvdXBJZCBzZXQgYnkgZWxlbWVudHMgdXNpbmcgZGF0YS1tYXRjaC1oZWlnaHRcbiAgICAgICAgJCgnW2RhdGEtbWF0Y2gtaGVpZ2h0XSwgW2RhdGEtbWhdJykuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHZhciAkdGhpcyA9ICQodGhpcyksXG4gICAgICAgICAgICAgICAgZ3JvdXBJZCA9ICR0aGlzLmF0dHIoJ2RhdGEtbWgnKSB8fCAkdGhpcy5hdHRyKCdkYXRhLW1hdGNoLWhlaWdodCcpO1xuXG4gICAgICAgICAgICBpZiAoZ3JvdXBJZCBpbiBncm91cHMpIHtcbiAgICAgICAgICAgICAgICBncm91cHNbZ3JvdXBJZF0gPSBncm91cHNbZ3JvdXBJZF0uYWRkKCR0aGlzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ3JvdXBzW2dyb3VwSWRdID0gJHRoaXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGFwcGx5IG1hdGNoSGVpZ2h0IHRvIGVhY2ggZ3JvdXBcbiAgICAgICAgJC5lYWNoKGdyb3VwcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLm1hdGNoSGVpZ2h0KHRydWUpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqICBtYXRjaEhlaWdodC5fdXBkYXRlXG4gICAgKiAgdXBkYXRlcyBtYXRjaEhlaWdodCBvbiBhbGwgY3VycmVudCBncm91cHMgd2l0aCB0aGVpciBjb3JyZWN0IG9wdGlvbnNcbiAgICAqL1xuXG4gICAgdmFyIF91cGRhdGUgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZiAobWF0Y2hIZWlnaHQuX2JlZm9yZVVwZGF0ZSkge1xuICAgICAgICAgICAgbWF0Y2hIZWlnaHQuX2JlZm9yZVVwZGF0ZShldmVudCwgbWF0Y2hIZWlnaHQuX2dyb3Vwcyk7XG4gICAgICAgIH1cblxuICAgICAgICAkLmVhY2gobWF0Y2hIZWlnaHQuX2dyb3VwcywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBtYXRjaEhlaWdodC5fYXBwbHkodGhpcy5lbGVtZW50cywgdGhpcy5vcHRpb25zKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKG1hdGNoSGVpZ2h0Ll9hZnRlclVwZGF0ZSkge1xuICAgICAgICAgICAgbWF0Y2hIZWlnaHQuX2FmdGVyVXBkYXRlKGV2ZW50LCBtYXRjaEhlaWdodC5fZ3JvdXBzKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBtYXRjaEhlaWdodC5fdXBkYXRlID0gZnVuY3Rpb24odGhyb3R0bGUsIGV2ZW50KSB7XG4gICAgICAgIC8vIHByZXZlbnQgdXBkYXRlIGlmIGZpcmVkIGZyb20gYSByZXNpemUgZXZlbnRcbiAgICAgICAgLy8gd2hlcmUgdGhlIHZpZXdwb3J0IHdpZHRoIGhhc24ndCBhY3R1YWxseSBjaGFuZ2VkXG4gICAgICAgIC8vIGZpeGVzIGFuIGV2ZW50IGxvb3BpbmcgYnVnIGluIElFOFxuICAgICAgICBpZiAoZXZlbnQgJiYgZXZlbnQudHlwZSA9PT0gJ3Jlc2l6ZScpIHtcbiAgICAgICAgICAgIHZhciB3aW5kb3dXaWR0aCA9ICQod2luZG93KS53aWR0aCgpO1xuICAgICAgICAgICAgaWYgKHdpbmRvd1dpZHRoID09PSBfcHJldmlvdXNSZXNpemVXaWR0aCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF9wcmV2aW91c1Jlc2l6ZVdpZHRoID0gd2luZG93V2lkdGg7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0aHJvdHRsZSB1cGRhdGVzXG4gICAgICAgIGlmICghdGhyb3R0bGUpIHtcbiAgICAgICAgICAgIF91cGRhdGUoZXZlbnQpO1xuICAgICAgICB9IGVsc2UgaWYgKF91cGRhdGVUaW1lb3V0ID09PSAtMSkge1xuICAgICAgICAgICAgX3VwZGF0ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIF91cGRhdGUoZXZlbnQpO1xuICAgICAgICAgICAgICAgIF91cGRhdGVUaW1lb3V0ID0gLTE7XG4gICAgICAgICAgICB9LCBtYXRjaEhlaWdodC5fdGhyb3R0bGUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiAgYmluZCBldmVudHNcbiAgICAqL1xuXG4gICAgLy8gYXBwbHkgb24gRE9NIHJlYWR5IGV2ZW50XG4gICAgJChtYXRjaEhlaWdodC5fYXBwbHlEYXRhQXBpKTtcblxuICAgIC8vIHVzZSBvbiBvciBiaW5kIHdoZXJlIHN1cHBvcnRlZFxuICAgIHZhciBvbiA9ICQuZm4ub24gPyAnb24nIDogJ2JpbmQnO1xuXG4gICAgLy8gdXBkYXRlIGhlaWdodHMgb24gbG9hZCBhbmQgcmVzaXplIGV2ZW50c1xuICAgICQod2luZG93KVtvbl0oJ2xvYWQnLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBtYXRjaEhlaWdodC5fdXBkYXRlKGZhbHNlLCBldmVudCk7XG4gICAgfSk7XG5cbiAgICAvLyB0aHJvdHRsZWQgdXBkYXRlIGhlaWdodHMgb24gcmVzaXplIGV2ZW50c1xuICAgICQod2luZG93KVtvbl0oJ3Jlc2l6ZSBvcmllbnRhdGlvbmNoYW5nZScsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIG1hdGNoSGVpZ2h0Ll91cGRhdGUodHJ1ZSwgZXZlbnQpO1xuICAgIH0pO1xuXG59KTtcbiIsIi8qIFdlYiBGb250IExvYWRlciB2MS42LjI4IC0gKGMpIEFkb2JlIFN5c3RlbXMsIEdvb2dsZS4gTGljZW5zZTogQXBhY2hlIDIuMCAqLyhmdW5jdGlvbigpe2Z1bmN0aW9uIGFhKGEsYixjKXtyZXR1cm4gYS5jYWxsLmFwcGx5KGEuYmluZCxhcmd1bWVudHMpfWZ1bmN0aW9uIGJhKGEsYixjKXtpZighYSl0aHJvdyBFcnJvcigpO2lmKDI8YXJndW1lbnRzLmxlbmd0aCl7dmFyIGQ9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDIpO3JldHVybiBmdW5jdGlvbigpe3ZhciBjPUFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7QXJyYXkucHJvdG90eXBlLnVuc2hpZnQuYXBwbHkoYyxkKTtyZXR1cm4gYS5hcHBseShiLGMpfX1yZXR1cm4gZnVuY3Rpb24oKXtyZXR1cm4gYS5hcHBseShiLGFyZ3VtZW50cyl9fWZ1bmN0aW9uIHAoYSxiLGMpe3A9RnVuY3Rpb24ucHJvdG90eXBlLmJpbmQmJi0xIT1GdW5jdGlvbi5wcm90b3R5cGUuYmluZC50b1N0cmluZygpLmluZGV4T2YoXCJuYXRpdmUgY29kZVwiKT9hYTpiYTtyZXR1cm4gcC5hcHBseShudWxsLGFyZ3VtZW50cyl9dmFyIHE9RGF0ZS5ub3d8fGZ1bmN0aW9uKCl7cmV0dXJuK25ldyBEYXRlfTtmdW5jdGlvbiBjYShhLGIpe3RoaXMuYT1hO3RoaXMubz1ifHxhO3RoaXMuYz10aGlzLm8uZG9jdW1lbnR9dmFyIGRhPSEhd2luZG93LkZvbnRGYWNlO2Z1bmN0aW9uIHQoYSxiLGMsZCl7Yj1hLmMuY3JlYXRlRWxlbWVudChiKTtpZihjKWZvcih2YXIgZSBpbiBjKWMuaGFzT3duUHJvcGVydHkoZSkmJihcInN0eWxlXCI9PWU/Yi5zdHlsZS5jc3NUZXh0PWNbZV06Yi5zZXRBdHRyaWJ1dGUoZSxjW2VdKSk7ZCYmYi5hcHBlbmRDaGlsZChhLmMuY3JlYXRlVGV4dE5vZGUoZCkpO3JldHVybiBifWZ1bmN0aW9uIHUoYSxiLGMpe2E9YS5jLmdldEVsZW1lbnRzQnlUYWdOYW1lKGIpWzBdO2F8fChhPWRvY3VtZW50LmRvY3VtZW50RWxlbWVudCk7YS5pbnNlcnRCZWZvcmUoYyxhLmxhc3RDaGlsZCl9ZnVuY3Rpb24gdihhKXthLnBhcmVudE5vZGUmJmEucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChhKX1cbmZ1bmN0aW9uIHcoYSxiLGMpe2I9Ynx8W107Yz1jfHxbXTtmb3IodmFyIGQ9YS5jbGFzc05hbWUuc3BsaXQoL1xccysvKSxlPTA7ZTxiLmxlbmd0aDtlKz0xKXtmb3IodmFyIGY9ITEsZz0wO2c8ZC5sZW5ndGg7Zys9MSlpZihiW2VdPT09ZFtnXSl7Zj0hMDticmVha31mfHxkLnB1c2goYltlXSl9Yj1bXTtmb3IoZT0wO2U8ZC5sZW5ndGg7ZSs9MSl7Zj0hMTtmb3IoZz0wO2c8Yy5sZW5ndGg7Zys9MSlpZihkW2VdPT09Y1tnXSl7Zj0hMDticmVha31mfHxiLnB1c2goZFtlXSl9YS5jbGFzc05hbWU9Yi5qb2luKFwiIFwiKS5yZXBsYWNlKC9cXHMrL2csXCIgXCIpLnJlcGxhY2UoL15cXHMrfFxccyskLyxcIlwiKX1mdW5jdGlvbiB5KGEsYil7Zm9yKHZhciBjPWEuY2xhc3NOYW1lLnNwbGl0KC9cXHMrLyksZD0wLGU9Yy5sZW5ndGg7ZDxlO2QrKylpZihjW2RdPT1iKXJldHVybiEwO3JldHVybiExfVxuZnVuY3Rpb24gZWEoYSl7cmV0dXJuIGEuby5sb2NhdGlvbi5ob3N0bmFtZXx8YS5hLmxvY2F0aW9uLmhvc3RuYW1lfWZ1bmN0aW9uIHooYSxiLGMpe2Z1bmN0aW9uIGQoKXttJiZlJiZmJiYobShnKSxtPW51bGwpfWI9dChhLFwibGlua1wiLHtyZWw6XCJzdHlsZXNoZWV0XCIsaHJlZjpiLG1lZGlhOlwiYWxsXCJ9KTt2YXIgZT0hMSxmPSEwLGc9bnVsbCxtPWN8fG51bGw7ZGE/KGIub25sb2FkPWZ1bmN0aW9uKCl7ZT0hMDtkKCl9LGIub25lcnJvcj1mdW5jdGlvbigpe2U9ITA7Zz1FcnJvcihcIlN0eWxlc2hlZXQgZmFpbGVkIHRvIGxvYWRcIik7ZCgpfSk6c2V0VGltZW91dChmdW5jdGlvbigpe2U9ITA7ZCgpfSwwKTt1KGEsXCJoZWFkXCIsYil9XG5mdW5jdGlvbiBBKGEsYixjLGQpe3ZhciBlPWEuYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcImhlYWRcIilbMF07aWYoZSl7dmFyIGY9dChhLFwic2NyaXB0XCIse3NyYzpifSksZz0hMTtmLm9ubG9hZD1mLm9ucmVhZHlzdGF0ZWNoYW5nZT1mdW5jdGlvbigpe2d8fHRoaXMucmVhZHlTdGF0ZSYmXCJsb2FkZWRcIiE9dGhpcy5yZWFkeVN0YXRlJiZcImNvbXBsZXRlXCIhPXRoaXMucmVhZHlTdGF0ZXx8KGc9ITAsYyYmYyhudWxsKSxmLm9ubG9hZD1mLm9ucmVhZHlzdGF0ZWNoYW5nZT1udWxsLFwiSEVBRFwiPT1mLnBhcmVudE5vZGUudGFnTmFtZSYmZS5yZW1vdmVDaGlsZChmKSl9O2UuYXBwZW5kQ2hpbGQoZik7c2V0VGltZW91dChmdW5jdGlvbigpe2d8fChnPSEwLGMmJmMoRXJyb3IoXCJTY3JpcHQgbG9hZCB0aW1lb3V0XCIpKSl9LGR8fDVFMyk7cmV0dXJuIGZ9cmV0dXJuIG51bGx9O2Z1bmN0aW9uIEIoKXt0aGlzLmE9MDt0aGlzLmM9bnVsbH1mdW5jdGlvbiBDKGEpe2EuYSsrO3JldHVybiBmdW5jdGlvbigpe2EuYS0tO0QoYSl9fWZ1bmN0aW9uIEUoYSxiKXthLmM9YjtEKGEpfWZ1bmN0aW9uIEQoYSl7MD09YS5hJiZhLmMmJihhLmMoKSxhLmM9bnVsbCl9O2Z1bmN0aW9uIEYoYSl7dGhpcy5hPWF8fFwiLVwifUYucHJvdG90eXBlLmM9ZnVuY3Rpb24oYSl7Zm9yKHZhciBiPVtdLGM9MDtjPGFyZ3VtZW50cy5sZW5ndGg7YysrKWIucHVzaChhcmd1bWVudHNbY10ucmVwbGFjZSgvW1xcV19dKy9nLFwiXCIpLnRvTG93ZXJDYXNlKCkpO3JldHVybiBiLmpvaW4odGhpcy5hKX07ZnVuY3Rpb24gRyhhLGIpe3RoaXMuYz1hO3RoaXMuZj00O3RoaXMuYT1cIm5cIjt2YXIgYz0oYnx8XCJuNFwiKS5tYXRjaCgvXihbbmlvXSkoWzEtOV0pJC9pKTtjJiYodGhpcy5hPWNbMV0sdGhpcy5mPXBhcnNlSW50KGNbMl0sMTApKX1mdW5jdGlvbiBmYShhKXtyZXR1cm4gSChhKStcIiBcIisoYS5mK1wiMDBcIikrXCIgMzAwcHggXCIrSShhLmMpfWZ1bmN0aW9uIEkoYSl7dmFyIGI9W107YT1hLnNwbGl0KC8sXFxzKi8pO2Zvcih2YXIgYz0wO2M8YS5sZW5ndGg7YysrKXt2YXIgZD1hW2NdLnJlcGxhY2UoL1snXCJdL2csXCJcIik7LTEhPWQuaW5kZXhPZihcIiBcIil8fC9eXFxkLy50ZXN0KGQpP2IucHVzaChcIidcIitkK1wiJ1wiKTpiLnB1c2goZCl9cmV0dXJuIGIuam9pbihcIixcIil9ZnVuY3Rpb24gSihhKXtyZXR1cm4gYS5hK2EuZn1mdW5jdGlvbiBIKGEpe3ZhciBiPVwibm9ybWFsXCI7XCJvXCI9PT1hLmE/Yj1cIm9ibGlxdWVcIjpcImlcIj09PWEuYSYmKGI9XCJpdGFsaWNcIik7cmV0dXJuIGJ9XG5mdW5jdGlvbiBnYShhKXt2YXIgYj00LGM9XCJuXCIsZD1udWxsO2EmJigoZD1hLm1hdGNoKC8obm9ybWFsfG9ibGlxdWV8aXRhbGljKS9pKSkmJmRbMV0mJihjPWRbMV0uc3Vic3RyKDAsMSkudG9Mb3dlckNhc2UoKSksKGQ9YS5tYXRjaCgvKFsxLTldMDB8bm9ybWFsfGJvbGQpL2kpKSYmZFsxXSYmKC9ib2xkL2kudGVzdChkWzFdKT9iPTc6L1sxLTldMDAvLnRlc3QoZFsxXSkmJihiPXBhcnNlSW50KGRbMV0uc3Vic3RyKDAsMSksMTApKSkpO3JldHVybiBjK2J9O2Z1bmN0aW9uIGhhKGEsYil7dGhpcy5jPWE7dGhpcy5mPWEuby5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7dGhpcy5oPWI7dGhpcy5hPW5ldyBGKFwiLVwiKTt0aGlzLmo9ITEhPT1iLmV2ZW50czt0aGlzLmc9ITEhPT1iLmNsYXNzZXN9ZnVuY3Rpb24gaWEoYSl7YS5nJiZ3KGEuZixbYS5hLmMoXCJ3ZlwiLFwibG9hZGluZ1wiKV0pO0soYSxcImxvYWRpbmdcIil9ZnVuY3Rpb24gTChhKXtpZihhLmcpe3ZhciBiPXkoYS5mLGEuYS5jKFwid2ZcIixcImFjdGl2ZVwiKSksYz1bXSxkPVthLmEuYyhcIndmXCIsXCJsb2FkaW5nXCIpXTtifHxjLnB1c2goYS5hLmMoXCJ3ZlwiLFwiaW5hY3RpdmVcIikpO3coYS5mLGMsZCl9SyhhLFwiaW5hY3RpdmVcIil9ZnVuY3Rpb24gSyhhLGIsYyl7aWYoYS5qJiZhLmhbYl0paWYoYylhLmhbYl0oYy5jLEooYykpO2Vsc2UgYS5oW2JdKCl9O2Z1bmN0aW9uIGphKCl7dGhpcy5jPXt9fWZ1bmN0aW9uIGthKGEsYixjKXt2YXIgZD1bXSxlO2ZvcihlIGluIGIpaWYoYi5oYXNPd25Qcm9wZXJ0eShlKSl7dmFyIGY9YS5jW2VdO2YmJmQucHVzaChmKGJbZV0sYykpfXJldHVybiBkfTtmdW5jdGlvbiBNKGEsYil7dGhpcy5jPWE7dGhpcy5mPWI7dGhpcy5hPXQodGhpcy5jLFwic3BhblwiLHtcImFyaWEtaGlkZGVuXCI6XCJ0cnVlXCJ9LHRoaXMuZil9ZnVuY3Rpb24gTihhKXt1KGEuYyxcImJvZHlcIixhLmEpfWZ1bmN0aW9uIE8oYSl7cmV0dXJuXCJkaXNwbGF5OmJsb2NrO3Bvc2l0aW9uOmFic29sdXRlO3RvcDotOTk5OXB4O2xlZnQ6LTk5OTlweDtmb250LXNpemU6MzAwcHg7d2lkdGg6YXV0bztoZWlnaHQ6YXV0bztsaW5lLWhlaWdodDpub3JtYWw7bWFyZ2luOjA7cGFkZGluZzowO2ZvbnQtdmFyaWFudDpub3JtYWw7d2hpdGUtc3BhY2U6bm93cmFwO2ZvbnQtZmFtaWx5OlwiK0koYS5jKStcIjtcIisoXCJmb250LXN0eWxlOlwiK0goYSkrXCI7Zm9udC13ZWlnaHQ6XCIrKGEuZitcIjAwXCIpK1wiO1wiKX07ZnVuY3Rpb24gUChhLGIsYyxkLGUsZil7dGhpcy5nPWE7dGhpcy5qPWI7dGhpcy5hPWQ7dGhpcy5jPWM7dGhpcy5mPWV8fDNFMzt0aGlzLmg9Znx8dm9pZCAwfVAucHJvdG90eXBlLnN0YXJ0PWZ1bmN0aW9uKCl7dmFyIGE9dGhpcy5jLm8uZG9jdW1lbnQsYj10aGlzLGM9cSgpLGQ9bmV3IFByb21pc2UoZnVuY3Rpb24oZCxlKXtmdW5jdGlvbiBmKCl7cSgpLWM+PWIuZj9lKCk6YS5mb250cy5sb2FkKGZhKGIuYSksYi5oKS50aGVuKGZ1bmN0aW9uKGEpezE8PWEubGVuZ3RoP2QoKTpzZXRUaW1lb3V0KGYsMjUpfSxmdW5jdGlvbigpe2UoKX0pfWYoKX0pLGU9bnVsbCxmPW5ldyBQcm9taXNlKGZ1bmN0aW9uKGEsZCl7ZT1zZXRUaW1lb3V0KGQsYi5mKX0pO1Byb21pc2UucmFjZShbZixkXSkudGhlbihmdW5jdGlvbigpe2UmJihjbGVhclRpbWVvdXQoZSksZT1udWxsKTtiLmcoYi5hKX0sZnVuY3Rpb24oKXtiLmooYi5hKX0pfTtmdW5jdGlvbiBRKGEsYixjLGQsZSxmLGcpe3RoaXMudj1hO3RoaXMuQj1iO3RoaXMuYz1jO3RoaXMuYT1kO3RoaXMucz1nfHxcIkJFU2Jzd3lcIjt0aGlzLmY9e307dGhpcy53PWV8fDNFMzt0aGlzLnU9Znx8bnVsbDt0aGlzLm09dGhpcy5qPXRoaXMuaD10aGlzLmc9bnVsbDt0aGlzLmc9bmV3IE0odGhpcy5jLHRoaXMucyk7dGhpcy5oPW5ldyBNKHRoaXMuYyx0aGlzLnMpO3RoaXMuaj1uZXcgTSh0aGlzLmMsdGhpcy5zKTt0aGlzLm09bmV3IE0odGhpcy5jLHRoaXMucyk7YT1uZXcgRyh0aGlzLmEuYytcIixzZXJpZlwiLEoodGhpcy5hKSk7YT1PKGEpO3RoaXMuZy5hLnN0eWxlLmNzc1RleHQ9YTthPW5ldyBHKHRoaXMuYS5jK1wiLHNhbnMtc2VyaWZcIixKKHRoaXMuYSkpO2E9TyhhKTt0aGlzLmguYS5zdHlsZS5jc3NUZXh0PWE7YT1uZXcgRyhcInNlcmlmXCIsSih0aGlzLmEpKTthPU8oYSk7dGhpcy5qLmEuc3R5bGUuY3NzVGV4dD1hO2E9bmV3IEcoXCJzYW5zLXNlcmlmXCIsSih0aGlzLmEpKTthPVxuTyhhKTt0aGlzLm0uYS5zdHlsZS5jc3NUZXh0PWE7Tih0aGlzLmcpO04odGhpcy5oKTtOKHRoaXMuaik7Tih0aGlzLm0pfXZhciBSPXtEOlwic2VyaWZcIixDOlwic2Fucy1zZXJpZlwifSxTPW51bGw7ZnVuY3Rpb24gVCgpe2lmKG51bGw9PT1TKXt2YXIgYT0vQXBwbGVXZWJLaXRcXC8oWzAtOV0rKSg/OlxcLihbMC05XSspKS8uZXhlYyh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCk7Uz0hIWEmJig1MzY+cGFyc2VJbnQoYVsxXSwxMCl8fDUzNj09PXBhcnNlSW50KGFbMV0sMTApJiYxMT49cGFyc2VJbnQoYVsyXSwxMCkpfXJldHVybiBTfVEucHJvdG90eXBlLnN0YXJ0PWZ1bmN0aW9uKCl7dGhpcy5mLnNlcmlmPXRoaXMuai5hLm9mZnNldFdpZHRoO3RoaXMuZltcInNhbnMtc2VyaWZcIl09dGhpcy5tLmEub2Zmc2V0V2lkdGg7dGhpcy5BPXEoKTtVKHRoaXMpfTtcbmZ1bmN0aW9uIGxhKGEsYixjKXtmb3IodmFyIGQgaW4gUilpZihSLmhhc093blByb3BlcnR5KGQpJiZiPT09YS5mW1JbZF1dJiZjPT09YS5mW1JbZF1dKXJldHVybiEwO3JldHVybiExfWZ1bmN0aW9uIFUoYSl7dmFyIGI9YS5nLmEub2Zmc2V0V2lkdGgsYz1hLmguYS5vZmZzZXRXaWR0aCxkOyhkPWI9PT1hLmYuc2VyaWYmJmM9PT1hLmZbXCJzYW5zLXNlcmlmXCJdKXx8KGQ9VCgpJiZsYShhLGIsYykpO2Q/cSgpLWEuQT49YS53P1QoKSYmbGEoYSxiLGMpJiYobnVsbD09PWEudXx8YS51Lmhhc093blByb3BlcnR5KGEuYS5jKSk/VihhLGEudik6VihhLGEuQik6bWEoYSk6VihhLGEudil9ZnVuY3Rpb24gbWEoYSl7c2V0VGltZW91dChwKGZ1bmN0aW9uKCl7VSh0aGlzKX0sYSksNTApfWZ1bmN0aW9uIFYoYSxiKXtzZXRUaW1lb3V0KHAoZnVuY3Rpb24oKXt2KHRoaXMuZy5hKTt2KHRoaXMuaC5hKTt2KHRoaXMuai5hKTt2KHRoaXMubS5hKTtiKHRoaXMuYSl9LGEpLDApfTtmdW5jdGlvbiBXKGEsYixjKXt0aGlzLmM9YTt0aGlzLmE9Yjt0aGlzLmY9MDt0aGlzLm09dGhpcy5qPSExO3RoaXMucz1jfXZhciBYPW51bGw7Vy5wcm90b3R5cGUuZz1mdW5jdGlvbihhKXt2YXIgYj10aGlzLmE7Yi5nJiZ3KGIuZixbYi5hLmMoXCJ3ZlwiLGEuYyxKKGEpLnRvU3RyaW5nKCksXCJhY3RpdmVcIildLFtiLmEuYyhcIndmXCIsYS5jLEooYSkudG9TdHJpbmcoKSxcImxvYWRpbmdcIiksYi5hLmMoXCJ3ZlwiLGEuYyxKKGEpLnRvU3RyaW5nKCksXCJpbmFjdGl2ZVwiKV0pO0soYixcImZvbnRhY3RpdmVcIixhKTt0aGlzLm09ITA7bmEodGhpcyl9O1xuVy5wcm90b3R5cGUuaD1mdW5jdGlvbihhKXt2YXIgYj10aGlzLmE7aWYoYi5nKXt2YXIgYz15KGIuZixiLmEuYyhcIndmXCIsYS5jLEooYSkudG9TdHJpbmcoKSxcImFjdGl2ZVwiKSksZD1bXSxlPVtiLmEuYyhcIndmXCIsYS5jLEooYSkudG9TdHJpbmcoKSxcImxvYWRpbmdcIildO2N8fGQucHVzaChiLmEuYyhcIndmXCIsYS5jLEooYSkudG9TdHJpbmcoKSxcImluYWN0aXZlXCIpKTt3KGIuZixkLGUpfUsoYixcImZvbnRpbmFjdGl2ZVwiLGEpO25hKHRoaXMpfTtmdW5jdGlvbiBuYShhKXswPT0tLWEuZiYmYS5qJiYoYS5tPyhhPWEuYSxhLmcmJncoYS5mLFthLmEuYyhcIndmXCIsXCJhY3RpdmVcIildLFthLmEuYyhcIndmXCIsXCJsb2FkaW5nXCIpLGEuYS5jKFwid2ZcIixcImluYWN0aXZlXCIpXSksSyhhLFwiYWN0aXZlXCIpKTpMKGEuYSkpfTtmdW5jdGlvbiBvYShhKXt0aGlzLmo9YTt0aGlzLmE9bmV3IGphO3RoaXMuaD0wO3RoaXMuZj10aGlzLmc9ITB9b2EucHJvdG90eXBlLmxvYWQ9ZnVuY3Rpb24oYSl7dGhpcy5jPW5ldyBjYSh0aGlzLmosYS5jb250ZXh0fHx0aGlzLmopO3RoaXMuZz0hMSE9PWEuZXZlbnRzO3RoaXMuZj0hMSE9PWEuY2xhc3NlcztwYSh0aGlzLG5ldyBoYSh0aGlzLmMsYSksYSl9O1xuZnVuY3Rpb24gcWEoYSxiLGMsZCxlKXt2YXIgZj0wPT0tLWEuaDsoYS5mfHxhLmcpJiZzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7dmFyIGE9ZXx8bnVsbCxtPWR8fG51bGx8fHt9O2lmKDA9PT1jLmxlbmd0aCYmZilMKGIuYSk7ZWxzZXtiLmYrPWMubGVuZ3RoO2YmJihiLmo9Zik7dmFyIGgsbD1bXTtmb3IoaD0wO2g8Yy5sZW5ndGg7aCsrKXt2YXIgaz1jW2hdLG49bVtrLmNdLHI9Yi5hLHg9aztyLmcmJncoci5mLFtyLmEuYyhcIndmXCIseC5jLEooeCkudG9TdHJpbmcoKSxcImxvYWRpbmdcIildKTtLKHIsXCJmb250bG9hZGluZ1wiLHgpO3I9bnVsbDtpZihudWxsPT09WClpZih3aW5kb3cuRm9udEZhY2Upe3ZhciB4PS9HZWNrby4qRmlyZWZveFxcLyhcXGQrKS8uZXhlYyh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCkseGE9L09TIFguKlZlcnNpb25cXC8xMFxcLi4qU2FmYXJpLy5leGVjKHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KSYmL0FwcGxlLy5leGVjKHdpbmRvdy5uYXZpZ2F0b3IudmVuZG9yKTtcblg9eD80MjxwYXJzZUludCh4WzFdLDEwKTp4YT8hMTohMH1lbHNlIFg9ITE7WD9yPW5ldyBQKHAoYi5nLGIpLHAoYi5oLGIpLGIuYyxrLGIucyxuKTpyPW5ldyBRKHAoYi5nLGIpLHAoYi5oLGIpLGIuYyxrLGIucyxhLG4pO2wucHVzaChyKX1mb3IoaD0wO2g8bC5sZW5ndGg7aCsrKWxbaF0uc3RhcnQoKX19LDApfWZ1bmN0aW9uIHBhKGEsYixjKXt2YXIgZD1bXSxlPWMudGltZW91dDtpYShiKTt2YXIgZD1rYShhLmEsYyxhLmMpLGY9bmV3IFcoYS5jLGIsZSk7YS5oPWQubGVuZ3RoO2I9MDtmb3IoYz1kLmxlbmd0aDtiPGM7YisrKWRbYl0ubG9hZChmdW5jdGlvbihiLGQsYyl7cWEoYSxmLGIsZCxjKX0pfTtmdW5jdGlvbiByYShhLGIpe3RoaXMuYz1hO3RoaXMuYT1ifVxucmEucHJvdG90eXBlLmxvYWQ9ZnVuY3Rpb24oYSl7ZnVuY3Rpb24gYigpe2lmKGZbXCJfX210aV9mbnRMc3RcIitkXSl7dmFyIGM9ZltcIl9fbXRpX2ZudExzdFwiK2RdKCksZT1bXSxoO2lmKGMpZm9yKHZhciBsPTA7bDxjLmxlbmd0aDtsKyspe3ZhciBrPWNbbF0uZm9udGZhbWlseTt2b2lkIDAhPWNbbF0uZm9udFN0eWxlJiZ2b2lkIDAhPWNbbF0uZm9udFdlaWdodD8oaD1jW2xdLmZvbnRTdHlsZStjW2xdLmZvbnRXZWlnaHQsZS5wdXNoKG5ldyBHKGssaCkpKTplLnB1c2gobmV3IEcoaykpfWEoZSl9ZWxzZSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7YigpfSw1MCl9dmFyIGM9dGhpcyxkPWMuYS5wcm9qZWN0SWQsZT1jLmEudmVyc2lvbjtpZihkKXt2YXIgZj1jLmMubztBKHRoaXMuYywoYy5hLmFwaXx8XCJodHRwczovL2Zhc3QuZm9udHMubmV0L2pzYXBpXCIpK1wiL1wiK2QrXCIuanNcIisoZT9cIj92PVwiK2U6XCJcIiksZnVuY3Rpb24oZSl7ZT9hKFtdKTooZltcIl9fTW9ub3R5cGVDb25maWd1cmF0aW9uX19cIitcbmRdPWZ1bmN0aW9uKCl7cmV0dXJuIGMuYX0sYigpKX0pLmlkPVwiX19Nb25vdHlwZUFQSVNjcmlwdF9fXCIrZH1lbHNlIGEoW10pfTtmdW5jdGlvbiBzYShhLGIpe3RoaXMuYz1hO3RoaXMuYT1ifXNhLnByb3RvdHlwZS5sb2FkPWZ1bmN0aW9uKGEpe3ZhciBiLGMsZD10aGlzLmEudXJsc3x8W10sZT10aGlzLmEuZmFtaWxpZXN8fFtdLGY9dGhpcy5hLnRlc3RTdHJpbmdzfHx7fSxnPW5ldyBCO2I9MDtmb3IoYz1kLmxlbmd0aDtiPGM7YisrKXoodGhpcy5jLGRbYl0sQyhnKSk7dmFyIG09W107Yj0wO2ZvcihjPWUubGVuZ3RoO2I8YztiKyspaWYoZD1lW2JdLnNwbGl0KFwiOlwiKSxkWzFdKWZvcih2YXIgaD1kWzFdLnNwbGl0KFwiLFwiKSxsPTA7bDxoLmxlbmd0aDtsKz0xKW0ucHVzaChuZXcgRyhkWzBdLGhbbF0pKTtlbHNlIG0ucHVzaChuZXcgRyhkWzBdKSk7RShnLGZ1bmN0aW9uKCl7YShtLGYpfSl9O2Z1bmN0aW9uIHRhKGEsYil7YT90aGlzLmM9YTp0aGlzLmM9dWE7dGhpcy5hPVtdO3RoaXMuZj1bXTt0aGlzLmc9Ynx8XCJcIn12YXIgdWE9XCJodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tL2Nzc1wiO2Z1bmN0aW9uIHZhKGEsYil7Zm9yKHZhciBjPWIubGVuZ3RoLGQ9MDtkPGM7ZCsrKXt2YXIgZT1iW2RdLnNwbGl0KFwiOlwiKTszPT1lLmxlbmd0aCYmYS5mLnB1c2goZS5wb3AoKSk7dmFyIGY9XCJcIjsyPT1lLmxlbmd0aCYmXCJcIiE9ZVsxXSYmKGY9XCI6XCIpO2EuYS5wdXNoKGUuam9pbihmKSl9fVxuZnVuY3Rpb24gd2EoYSl7aWYoMD09YS5hLmxlbmd0aCl0aHJvdyBFcnJvcihcIk5vIGZvbnRzIHRvIGxvYWQhXCIpO2lmKC0xIT1hLmMuaW5kZXhPZihcImtpdD1cIikpcmV0dXJuIGEuYztmb3IodmFyIGI9YS5hLmxlbmd0aCxjPVtdLGQ9MDtkPGI7ZCsrKWMucHVzaChhLmFbZF0ucmVwbGFjZSgvIC9nLFwiK1wiKSk7Yj1hLmMrXCI/ZmFtaWx5PVwiK2Muam9pbihcIiU3Q1wiKTswPGEuZi5sZW5ndGgmJihiKz1cIiZzdWJzZXQ9XCIrYS5mLmpvaW4oXCIsXCIpKTswPGEuZy5sZW5ndGgmJihiKz1cIiZ0ZXh0PVwiK2VuY29kZVVSSUNvbXBvbmVudChhLmcpKTtyZXR1cm4gYn07ZnVuY3Rpb24geWEoYSl7dGhpcy5mPWE7dGhpcy5hPVtdO3RoaXMuYz17fX1cbnZhciB6YT17bGF0aW46XCJCRVNic3d5XCIsXCJsYXRpbi1leHRcIjpcIlxcdTAwZTdcXHUwMGY2XFx1MDBmY1xcdTAxMWZcXHUwMTVmXCIsY3lyaWxsaWM6XCJcXHUwNDM5XFx1MDQ0ZlxcdTA0MTZcIixncmVlazpcIlxcdTAzYjFcXHUwM2IyXFx1MDNhM1wiLGtobWVyOlwiXFx1MTc4MFxcdTE3ODFcXHUxNzgyXCIsSGFudW1hbjpcIlxcdTE3ODBcXHUxNzgxXFx1MTc4MlwifSxBYT17dGhpbjpcIjFcIixleHRyYWxpZ2h0OlwiMlwiLFwiZXh0cmEtbGlnaHRcIjpcIjJcIix1bHRyYWxpZ2h0OlwiMlwiLFwidWx0cmEtbGlnaHRcIjpcIjJcIixsaWdodDpcIjNcIixyZWd1bGFyOlwiNFwiLGJvb2s6XCI0XCIsbWVkaXVtOlwiNVwiLFwic2VtaS1ib2xkXCI6XCI2XCIsc2VtaWJvbGQ6XCI2XCIsXCJkZW1pLWJvbGRcIjpcIjZcIixkZW1pYm9sZDpcIjZcIixib2xkOlwiN1wiLFwiZXh0cmEtYm9sZFwiOlwiOFwiLGV4dHJhYm9sZDpcIjhcIixcInVsdHJhLWJvbGRcIjpcIjhcIix1bHRyYWJvbGQ6XCI4XCIsYmxhY2s6XCI5XCIsaGVhdnk6XCI5XCIsbDpcIjNcIixyOlwiNFwiLGI6XCI3XCJ9LEJhPXtpOlwiaVwiLGl0YWxpYzpcImlcIixuOlwiblwiLG5vcm1hbDpcIm5cIn0sXG5DYT0vXih0aGlufCg/Oig/OmV4dHJhfHVsdHJhKS0/KT9saWdodHxyZWd1bGFyfGJvb2t8bWVkaXVtfCg/Oig/OnNlbWl8ZGVtaXxleHRyYXx1bHRyYSktPyk/Ym9sZHxibGFja3xoZWF2eXxsfHJ8YnxbMS05XTAwKT8obnxpfG5vcm1hbHxpdGFsaWMpPyQvO1xuZnVuY3Rpb24gRGEoYSl7Zm9yKHZhciBiPWEuZi5sZW5ndGgsYz0wO2M8YjtjKyspe3ZhciBkPWEuZltjXS5zcGxpdChcIjpcIiksZT1kWzBdLnJlcGxhY2UoL1xcKy9nLFwiIFwiKSxmPVtcIm40XCJdO2lmKDI8PWQubGVuZ3RoKXt2YXIgZzt2YXIgbT1kWzFdO2c9W107aWYobSlmb3IodmFyIG09bS5zcGxpdChcIixcIiksaD1tLmxlbmd0aCxsPTA7bDxoO2wrKyl7dmFyIGs7az1tW2xdO2lmKGsubWF0Y2goL15bXFx3LV0rJC8pKXt2YXIgbj1DYS5leGVjKGsudG9Mb3dlckNhc2UoKSk7aWYobnVsbD09bilrPVwiXCI7ZWxzZXtrPW5bMl07az1udWxsPT1rfHxcIlwiPT1rP1wiblwiOkJhW2tdO249blsxXTtpZihudWxsPT1ufHxcIlwiPT1uKW49XCI0XCI7ZWxzZSB2YXIgcj1BYVtuXSxuPXI/cjppc05hTihuKT9cIjRcIjpuLnN1YnN0cigwLDEpO2s9W2ssbl0uam9pbihcIlwiKX19ZWxzZSBrPVwiXCI7ayYmZy5wdXNoKGspfTA8Zy5sZW5ndGgmJihmPWcpOzM9PWQubGVuZ3RoJiYoZD1kWzJdLGc9W10sZD1kP2Quc3BsaXQoXCIsXCIpOlxuZywwPGQubGVuZ3RoJiYoZD16YVtkWzBdXSkmJihhLmNbZV09ZCkpfWEuY1tlXXx8KGQ9emFbZV0pJiYoYS5jW2VdPWQpO2ZvcihkPTA7ZDxmLmxlbmd0aDtkKz0xKWEuYS5wdXNoKG5ldyBHKGUsZltkXSkpfX07ZnVuY3Rpb24gRWEoYSxiKXt0aGlzLmM9YTt0aGlzLmE9Yn12YXIgRmE9e0FyaW1vOiEwLENvdXNpbmU6ITAsVGlub3M6ITB9O0VhLnByb3RvdHlwZS5sb2FkPWZ1bmN0aW9uKGEpe3ZhciBiPW5ldyBCLGM9dGhpcy5jLGQ9bmV3IHRhKHRoaXMuYS5hcGksdGhpcy5hLnRleHQpLGU9dGhpcy5hLmZhbWlsaWVzO3ZhKGQsZSk7dmFyIGY9bmV3IHlhKGUpO0RhKGYpO3ooYyx3YShkKSxDKGIpKTtFKGIsZnVuY3Rpb24oKXthKGYuYSxmLmMsRmEpfSl9O2Z1bmN0aW9uIEdhKGEsYil7dGhpcy5jPWE7dGhpcy5hPWJ9R2EucHJvdG90eXBlLmxvYWQ9ZnVuY3Rpb24oYSl7dmFyIGI9dGhpcy5hLmlkLGM9dGhpcy5jLm87Yj9BKHRoaXMuYywodGhpcy5hLmFwaXx8XCJodHRwczovL3VzZS50eXBla2l0Lm5ldFwiKStcIi9cIitiK1wiLmpzXCIsZnVuY3Rpb24oYil7aWYoYilhKFtdKTtlbHNlIGlmKGMuVHlwZWtpdCYmYy5UeXBla2l0LmNvbmZpZyYmYy5UeXBla2l0LmNvbmZpZy5mbil7Yj1jLlR5cGVraXQuY29uZmlnLmZuO2Zvcih2YXIgZT1bXSxmPTA7ZjxiLmxlbmd0aDtmKz0yKWZvcih2YXIgZz1iW2ZdLG09YltmKzFdLGg9MDtoPG0ubGVuZ3RoO2grKyllLnB1c2gobmV3IEcoZyxtW2hdKSk7dHJ5e2MuVHlwZWtpdC5sb2FkKHtldmVudHM6ITEsY2xhc3NlczohMSxhc3luYzohMH0pfWNhdGNoKGwpe31hKGUpfX0sMkUzKTphKFtdKX07ZnVuY3Rpb24gSGEoYSxiKXt0aGlzLmM9YTt0aGlzLmY9Yjt0aGlzLmE9W119SGEucHJvdG90eXBlLmxvYWQ9ZnVuY3Rpb24oYSl7dmFyIGI9dGhpcy5mLmlkLGM9dGhpcy5jLm8sZD10aGlzO2I/KGMuX193ZWJmb250Zm9udGRlY2ttb2R1bGVfX3x8KGMuX193ZWJmb250Zm9udGRlY2ttb2R1bGVfXz17fSksYy5fX3dlYmZvbnRmb250ZGVja21vZHVsZV9fW2JdPWZ1bmN0aW9uKGIsYyl7Zm9yKHZhciBnPTAsbT1jLmZvbnRzLmxlbmd0aDtnPG07KytnKXt2YXIgaD1jLmZvbnRzW2ddO2QuYS5wdXNoKG5ldyBHKGgubmFtZSxnYShcImZvbnQtd2VpZ2h0OlwiK2gud2VpZ2h0K1wiO2ZvbnQtc3R5bGU6XCIraC5zdHlsZSkpKX1hKGQuYSl9LEEodGhpcy5jLCh0aGlzLmYuYXBpfHxcImh0dHBzOi8vZi5mb250ZGVjay5jb20vcy9jc3MvanMvXCIpK2VhKHRoaXMuYykrXCIvXCIrYitcIi5qc1wiLGZ1bmN0aW9uKGIpe2ImJmEoW10pfSkpOmEoW10pfTt2YXIgWT1uZXcgb2Eod2luZG93KTtZLmEuYy5jdXN0b209ZnVuY3Rpb24oYSxiKXtyZXR1cm4gbmV3IHNhKGIsYSl9O1kuYS5jLmZvbnRkZWNrPWZ1bmN0aW9uKGEsYil7cmV0dXJuIG5ldyBIYShiLGEpfTtZLmEuYy5tb25vdHlwZT1mdW5jdGlvbihhLGIpe3JldHVybiBuZXcgcmEoYixhKX07WS5hLmMudHlwZWtpdD1mdW5jdGlvbihhLGIpe3JldHVybiBuZXcgR2EoYixhKX07WS5hLmMuZ29vZ2xlPWZ1bmN0aW9uKGEsYil7cmV0dXJuIG5ldyBFYShiLGEpfTt2YXIgWj17bG9hZDpwKFkubG9hZCxZKX07XCJmdW5jdGlvblwiPT09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZD9kZWZpbmUoZnVuY3Rpb24oKXtyZXR1cm4gWn0pOlwidW5kZWZpbmVkXCIhPT10eXBlb2YgbW9kdWxlJiZtb2R1bGUuZXhwb3J0cz9tb2R1bGUuZXhwb3J0cz1aOih3aW5kb3cuV2ViRm9udD1aLHdpbmRvdy5XZWJGb250Q29uZmlnJiZZLmxvYWQod2luZG93LldlYkZvbnRDb25maWcpKTt9KCkpO1xuIiwiZnVuY3Rpb24gX2V4dGVuZHMoKSB7IF9leHRlbmRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0KSB7IGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7IHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07IGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHsgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTsgfSB9IH0gcmV0dXJuIHRhcmdldDsgfTsgcmV0dXJuIF9leHRlbmRzLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7IH1cblxuZnVuY3Rpb24gX2RlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfVxuXG5mdW5jdGlvbiBfY3JlYXRlQ2xhc3MoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBfZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIF9kZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfVxuXG4vKipcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCb290c3RyYXAgKHY0LjAuMCk6IGNvbGxhcHNlLmpzXG4gKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21hc3Rlci9MSUNFTlNFKVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqL1xudmFyIENvbGxhcHNlID0gZnVuY3Rpb24gKCQpIHtcbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBDb25zdGFudHNcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuICB2YXIgTkFNRSA9ICdjb2xsYXBzZSc7XG4gIHZhciBWRVJTSU9OID0gJzQuMC4wJztcbiAgdmFyIERBVEFfS0VZID0gJ2JzLmNvbGxhcHNlJztcbiAgdmFyIEVWRU5UX0tFWSA9IFwiLlwiICsgREFUQV9LRVk7XG4gIHZhciBEQVRBX0FQSV9LRVkgPSAnLmRhdGEtYXBpJztcbiAgdmFyIEpRVUVSWV9OT19DT05GTElDVCA9ICQuZm5bTkFNRV07XG4gIHZhciBUUkFOU0lUSU9OX0RVUkFUSU9OID0gNjAwO1xuICB2YXIgRGVmYXVsdCA9IHtcbiAgICB0b2dnbGU6IHRydWUsXG4gICAgcGFyZW50OiAnJ1xuICB9O1xuICB2YXIgRGVmYXVsdFR5cGUgPSB7XG4gICAgdG9nZ2xlOiAnYm9vbGVhbicsXG4gICAgcGFyZW50OiAnKHN0cmluZ3xlbGVtZW50KSdcbiAgfTtcbiAgdmFyIEV2ZW50ID0ge1xuICAgIFNIT1c6IFwic2hvd1wiICsgRVZFTlRfS0VZLFxuICAgIFNIT1dOOiBcInNob3duXCIgKyBFVkVOVF9LRVksXG4gICAgSElERTogXCJoaWRlXCIgKyBFVkVOVF9LRVksXG4gICAgSElEREVOOiBcImhpZGRlblwiICsgRVZFTlRfS0VZLFxuICAgIENMSUNLX0RBVEFfQVBJOiBcImNsaWNrXCIgKyBFVkVOVF9LRVkgKyBEQVRBX0FQSV9LRVlcbiAgfTtcbiAgdmFyIENsYXNzTmFtZSA9IHtcbiAgICBTSE9XOiAnc2hvdycsXG4gICAgQ09MTEFQU0U6ICdjb2xsYXBzZScsXG4gICAgQ09MTEFQU0lORzogJ2NvbGxhcHNpbmcnLFxuICAgIENPTExBUFNFRDogJ2NvbGxhcHNlZCdcbiAgfTtcbiAgdmFyIERpbWVuc2lvbiA9IHtcbiAgICBXSURUSDogJ3dpZHRoJyxcbiAgICBIRUlHSFQ6ICdoZWlnaHQnXG4gIH07XG4gIHZhciBTZWxlY3RvciA9IHtcbiAgICBBQ1RJVkVTOiAnLnNob3csIC5jb2xsYXBzaW5nJyxcbiAgICBEQVRBX1RPR0dMRTogJ1tkYXRhLXRvZ2dsZT1cImNvbGxhcHNlXCJdJ1xuICAgIC8qKlxuICAgICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAqIENsYXNzIERlZmluaXRpb25cbiAgICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgKi9cblxuICB9O1xuXG4gIHZhciBDb2xsYXBzZSA9XG4gIC8qI19fUFVSRV9fKi9cbiAgZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIENvbGxhcHNlKGVsZW1lbnQsIGNvbmZpZykge1xuICAgICAgdGhpcy5faXNUcmFuc2l0aW9uaW5nID0gZmFsc2U7XG4gICAgICB0aGlzLl9lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgIHRoaXMuX2NvbmZpZyA9IHRoaXMuX2dldENvbmZpZyhjb25maWcpO1xuICAgICAgdGhpcy5fdHJpZ2dlckFycmF5ID0gJC5tYWtlQXJyYXkoJChcIltkYXRhLXRvZ2dsZT1cXFwiY29sbGFwc2VcXFwiXVtocmVmPVxcXCIjXCIgKyBlbGVtZW50LmlkICsgXCJcXFwiXSxcIiArIChcIltkYXRhLXRvZ2dsZT1cXFwiY29sbGFwc2VcXFwiXVtkYXRhLXRhcmdldD1cXFwiI1wiICsgZWxlbWVudC5pZCArIFwiXFxcIl1cIikpKTtcbiAgICAgIHZhciB0YWJUb2dnbGVzID0gJChTZWxlY3Rvci5EQVRBX1RPR0dMRSk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFiVG9nZ2xlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgZWxlbSA9IHRhYlRvZ2dsZXNbaV07XG4gICAgICAgIHZhciBzZWxlY3RvciA9IFV0aWwuZ2V0U2VsZWN0b3JGcm9tRWxlbWVudChlbGVtKTtcblxuICAgICAgICBpZiAoc2VsZWN0b3IgIT09IG51bGwgJiYgJChzZWxlY3RvcikuZmlsdGVyKGVsZW1lbnQpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB0aGlzLl9zZWxlY3RvciA9IHNlbGVjdG9yO1xuXG4gICAgICAgICAgdGhpcy5fdHJpZ2dlckFycmF5LnB1c2goZWxlbSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5fcGFyZW50ID0gdGhpcy5fY29uZmlnLnBhcmVudCA/IHRoaXMuX2dldFBhcmVudCgpIDogbnVsbDtcblxuICAgICAgaWYgKCF0aGlzLl9jb25maWcucGFyZW50KSB7XG4gICAgICAgIHRoaXMuX2FkZEFyaWFBbmRDb2xsYXBzZWRDbGFzcyh0aGlzLl9lbGVtZW50LCB0aGlzLl90cmlnZ2VyQXJyYXkpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fY29uZmlnLnRvZ2dsZSkge1xuICAgICAgICB0aGlzLnRvZ2dsZSgpO1xuICAgICAgfVxuICAgIH0gLy8gR2V0dGVyc1xuXG5cbiAgICB2YXIgX3Byb3RvID0gQ29sbGFwc2UucHJvdG90eXBlO1xuXG4gICAgLy8gUHVibGljXG4gICAgX3Byb3RvLnRvZ2dsZSA9IGZ1bmN0aW9uIHRvZ2dsZSgpIHtcbiAgICAgIGlmICgkKHRoaXMuX2VsZW1lbnQpLmhhc0NsYXNzKENsYXNzTmFtZS5TSE9XKSkge1xuICAgICAgICB0aGlzLmhpZGUoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2hvdygpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBfcHJvdG8uc2hvdyA9IGZ1bmN0aW9uIHNob3coKSB7XG4gICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgICBpZiAodGhpcy5faXNUcmFuc2l0aW9uaW5nIHx8ICQodGhpcy5fZWxlbWVudCkuaGFzQ2xhc3MoQ2xhc3NOYW1lLlNIT1cpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIGFjdGl2ZXM7XG4gICAgICB2YXIgYWN0aXZlc0RhdGE7XG5cbiAgICAgIGlmICh0aGlzLl9wYXJlbnQpIHtcbiAgICAgICAgYWN0aXZlcyA9ICQubWFrZUFycmF5KCQodGhpcy5fcGFyZW50KS5maW5kKFNlbGVjdG9yLkFDVElWRVMpLmZpbHRlcihcIltkYXRhLXBhcmVudD1cXFwiXCIgKyB0aGlzLl9jb25maWcucGFyZW50ICsgXCJcXFwiXVwiKSk7XG5cbiAgICAgICAgaWYgKGFjdGl2ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgYWN0aXZlcyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGFjdGl2ZXMpIHtcbiAgICAgICAgYWN0aXZlc0RhdGEgPSAkKGFjdGl2ZXMpLm5vdCh0aGlzLl9zZWxlY3RvcikuZGF0YShEQVRBX0tFWSk7XG5cbiAgICAgICAgaWYgKGFjdGl2ZXNEYXRhICYmIGFjdGl2ZXNEYXRhLl9pc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIHN0YXJ0RXZlbnQgPSAkLkV2ZW50KEV2ZW50LlNIT1cpO1xuICAgICAgJCh0aGlzLl9lbGVtZW50KS50cmlnZ2VyKHN0YXJ0RXZlbnQpO1xuXG4gICAgICBpZiAoc3RhcnRFdmVudC5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChhY3RpdmVzKSB7XG4gICAgICAgIENvbGxhcHNlLl9qUXVlcnlJbnRlcmZhY2UuY2FsbCgkKGFjdGl2ZXMpLm5vdCh0aGlzLl9zZWxlY3RvciksICdoaWRlJyk7XG5cbiAgICAgICAgaWYgKCFhY3RpdmVzRGF0YSkge1xuICAgICAgICAgICQoYWN0aXZlcykuZGF0YShEQVRBX0tFWSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIGRpbWVuc2lvbiA9IHRoaXMuX2dldERpbWVuc2lvbigpO1xuXG4gICAgICAkKHRoaXMuX2VsZW1lbnQpLnJlbW92ZUNsYXNzKENsYXNzTmFtZS5DT0xMQVBTRSkuYWRkQ2xhc3MoQ2xhc3NOYW1lLkNPTExBUFNJTkcpO1xuICAgICAgdGhpcy5fZWxlbWVudC5zdHlsZVtkaW1lbnNpb25dID0gMDtcblxuICAgICAgaWYgKHRoaXMuX3RyaWdnZXJBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICQodGhpcy5fdHJpZ2dlckFycmF5KS5yZW1vdmVDbGFzcyhDbGFzc05hbWUuQ09MTEFQU0VEKS5hdHRyKCdhcmlhLWV4cGFuZGVkJywgdHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc2V0VHJhbnNpdGlvbmluZyh0cnVlKTtcblxuICAgICAgdmFyIGNvbXBsZXRlID0gZnVuY3Rpb24gY29tcGxldGUoKSB7XG4gICAgICAgICQoX3RoaXMuX2VsZW1lbnQpLnJlbW92ZUNsYXNzKENsYXNzTmFtZS5DT0xMQVBTSU5HKS5hZGRDbGFzcyhDbGFzc05hbWUuQ09MTEFQU0UpLmFkZENsYXNzKENsYXNzTmFtZS5TSE9XKTtcbiAgICAgICAgX3RoaXMuX2VsZW1lbnQuc3R5bGVbZGltZW5zaW9uXSA9ICcnO1xuXG4gICAgICAgIF90aGlzLnNldFRyYW5zaXRpb25pbmcoZmFsc2UpO1xuXG4gICAgICAgICQoX3RoaXMuX2VsZW1lbnQpLnRyaWdnZXIoRXZlbnQuU0hPV04pO1xuICAgICAgfTtcblxuICAgICAgaWYgKCFVdGlsLnN1cHBvcnRzVHJhbnNpdGlvbkVuZCgpKSB7XG4gICAgICAgIGNvbXBsZXRlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIGNhcGl0YWxpemVkRGltZW5zaW9uID0gZGltZW5zaW9uWzBdLnRvVXBwZXJDYXNlKCkgKyBkaW1lbnNpb24uc2xpY2UoMSk7XG4gICAgICB2YXIgc2Nyb2xsU2l6ZSA9IFwic2Nyb2xsXCIgKyBjYXBpdGFsaXplZERpbWVuc2lvbjtcbiAgICAgICQodGhpcy5fZWxlbWVudCkub25lKFV0aWwuVFJBTlNJVElPTl9FTkQsIGNvbXBsZXRlKS5lbXVsYXRlVHJhbnNpdGlvbkVuZChUUkFOU0lUSU9OX0RVUkFUSU9OKTtcbiAgICAgIHRoaXMuX2VsZW1lbnQuc3R5bGVbZGltZW5zaW9uXSA9IHRoaXMuX2VsZW1lbnRbc2Nyb2xsU2l6ZV0gKyBcInB4XCI7XG4gICAgfTtcblxuICAgIF9wcm90by5oaWRlID0gZnVuY3Rpb24gaGlkZSgpIHtcbiAgICAgIHZhciBfdGhpczIgPSB0aGlzO1xuXG4gICAgICBpZiAodGhpcy5faXNUcmFuc2l0aW9uaW5nIHx8ICEkKHRoaXMuX2VsZW1lbnQpLmhhc0NsYXNzKENsYXNzTmFtZS5TSE9XKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciBzdGFydEV2ZW50ID0gJC5FdmVudChFdmVudC5ISURFKTtcbiAgICAgICQodGhpcy5fZWxlbWVudCkudHJpZ2dlcihzdGFydEV2ZW50KTtcblxuICAgICAgaWYgKHN0YXJ0RXZlbnQuaXNEZWZhdWx0UHJldmVudGVkKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgZGltZW5zaW9uID0gdGhpcy5fZ2V0RGltZW5zaW9uKCk7XG5cbiAgICAgIHRoaXMuX2VsZW1lbnQuc3R5bGVbZGltZW5zaW9uXSA9IHRoaXMuX2VsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClbZGltZW5zaW9uXSArIFwicHhcIjtcbiAgICAgIFV0aWwucmVmbG93KHRoaXMuX2VsZW1lbnQpO1xuICAgICAgJCh0aGlzLl9lbGVtZW50KS5hZGRDbGFzcyhDbGFzc05hbWUuQ09MTEFQU0lORykucmVtb3ZlQ2xhc3MoQ2xhc3NOYW1lLkNPTExBUFNFKS5yZW1vdmVDbGFzcyhDbGFzc05hbWUuU0hPVyk7XG5cbiAgICAgIGlmICh0aGlzLl90cmlnZ2VyQXJyYXkubGVuZ3RoID4gMCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX3RyaWdnZXJBcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHZhciB0cmlnZ2VyID0gdGhpcy5fdHJpZ2dlckFycmF5W2ldO1xuICAgICAgICAgIHZhciBzZWxlY3RvciA9IFV0aWwuZ2V0U2VsZWN0b3JGcm9tRWxlbWVudCh0cmlnZ2VyKTtcblxuICAgICAgICAgIGlmIChzZWxlY3RvciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdmFyICRlbGVtID0gJChzZWxlY3Rvcik7XG5cbiAgICAgICAgICAgIGlmICghJGVsZW0uaGFzQ2xhc3MoQ2xhc3NOYW1lLlNIT1cpKSB7XG4gICAgICAgICAgICAgICQodHJpZ2dlcikuYWRkQ2xhc3MoQ2xhc3NOYW1lLkNPTExBUFNFRCkuYXR0cignYXJpYS1leHBhbmRlZCcsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5zZXRUcmFuc2l0aW9uaW5nKHRydWUpO1xuXG4gICAgICB2YXIgY29tcGxldGUgPSBmdW5jdGlvbiBjb21wbGV0ZSgpIHtcbiAgICAgICAgX3RoaXMyLnNldFRyYW5zaXRpb25pbmcoZmFsc2UpO1xuXG4gICAgICAgICQoX3RoaXMyLl9lbGVtZW50KS5yZW1vdmVDbGFzcyhDbGFzc05hbWUuQ09MTEFQU0lORykuYWRkQ2xhc3MoQ2xhc3NOYW1lLkNPTExBUFNFKS50cmlnZ2VyKEV2ZW50LkhJRERFTik7XG4gICAgICB9O1xuXG4gICAgICB0aGlzLl9lbGVtZW50LnN0eWxlW2RpbWVuc2lvbl0gPSAnJztcblxuICAgICAgaWYgKCFVdGlsLnN1cHBvcnRzVHJhbnNpdGlvbkVuZCgpKSB7XG4gICAgICAgIGNvbXBsZXRlKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgJCh0aGlzLl9lbGVtZW50KS5vbmUoVXRpbC5UUkFOU0lUSU9OX0VORCwgY29tcGxldGUpLmVtdWxhdGVUcmFuc2l0aW9uRW5kKFRSQU5TSVRJT05fRFVSQVRJT04pO1xuICAgIH07XG5cbiAgICBfcHJvdG8uc2V0VHJhbnNpdGlvbmluZyA9IGZ1bmN0aW9uIHNldFRyYW5zaXRpb25pbmcoaXNUcmFuc2l0aW9uaW5nKSB7XG4gICAgICB0aGlzLl9pc1RyYW5zaXRpb25pbmcgPSBpc1RyYW5zaXRpb25pbmc7XG4gICAgfTtcblxuICAgIF9wcm90by5kaXNwb3NlID0gZnVuY3Rpb24gZGlzcG9zZSgpIHtcbiAgICAgICQucmVtb3ZlRGF0YSh0aGlzLl9lbGVtZW50LCBEQVRBX0tFWSk7XG4gICAgICB0aGlzLl9jb25maWcgPSBudWxsO1xuICAgICAgdGhpcy5fcGFyZW50ID0gbnVsbDtcbiAgICAgIHRoaXMuX2VsZW1lbnQgPSBudWxsO1xuICAgICAgdGhpcy5fdHJpZ2dlckFycmF5ID0gbnVsbDtcbiAgICAgIHRoaXMuX2lzVHJhbnNpdGlvbmluZyA9IG51bGw7XG4gICAgfTsgLy8gUHJpdmF0ZVxuXG5cbiAgICBfcHJvdG8uX2dldENvbmZpZyA9IGZ1bmN0aW9uIF9nZXRDb25maWcoY29uZmlnKSB7XG4gICAgICBjb25maWcgPSBfZXh0ZW5kcyh7fSwgRGVmYXVsdCwgY29uZmlnKTtcbiAgICAgIGNvbmZpZy50b2dnbGUgPSBCb29sZWFuKGNvbmZpZy50b2dnbGUpOyAvLyBDb2VyY2Ugc3RyaW5nIHZhbHVlc1xuXG4gICAgICBVdGlsLnR5cGVDaGVja0NvbmZpZyhOQU1FLCBjb25maWcsIERlZmF1bHRUeXBlKTtcbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfTtcblxuICAgIF9wcm90by5fZ2V0RGltZW5zaW9uID0gZnVuY3Rpb24gX2dldERpbWVuc2lvbigpIHtcbiAgICAgIHZhciBoYXNXaWR0aCA9ICQodGhpcy5fZWxlbWVudCkuaGFzQ2xhc3MoRGltZW5zaW9uLldJRFRIKTtcbiAgICAgIHJldHVybiBoYXNXaWR0aCA/IERpbWVuc2lvbi5XSURUSCA6IERpbWVuc2lvbi5IRUlHSFQ7XG4gICAgfTtcblxuICAgIF9wcm90by5fZ2V0UGFyZW50ID0gZnVuY3Rpb24gX2dldFBhcmVudCgpIHtcbiAgICAgIHZhciBfdGhpczMgPSB0aGlzO1xuXG4gICAgICB2YXIgcGFyZW50ID0gbnVsbDtcblxuICAgICAgaWYgKFV0aWwuaXNFbGVtZW50KHRoaXMuX2NvbmZpZy5wYXJlbnQpKSB7XG4gICAgICAgIHBhcmVudCA9IHRoaXMuX2NvbmZpZy5wYXJlbnQ7IC8vIEl0J3MgYSBqUXVlcnkgb2JqZWN0XG5cbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLl9jb25maWcucGFyZW50LmpxdWVyeSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBwYXJlbnQgPSB0aGlzLl9jb25maWcucGFyZW50WzBdO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJlbnQgPSAkKHRoaXMuX2NvbmZpZy5wYXJlbnQpWzBdO1xuICAgICAgfVxuXG4gICAgICB2YXIgc2VsZWN0b3IgPSBcIltkYXRhLXRvZ2dsZT1cXFwiY29sbGFwc2VcXFwiXVtkYXRhLXBhcmVudD1cXFwiXCIgKyB0aGlzLl9jb25maWcucGFyZW50ICsgXCJcXFwiXVwiO1xuICAgICAgJChwYXJlbnQpLmZpbmQoc2VsZWN0b3IpLmVhY2goZnVuY3Rpb24gKGksIGVsZW1lbnQpIHtcbiAgICAgICAgX3RoaXMzLl9hZGRBcmlhQW5kQ29sbGFwc2VkQ2xhc3MoQ29sbGFwc2UuX2dldFRhcmdldEZyb21FbGVtZW50KGVsZW1lbnQpLCBbZWxlbWVudF0pO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcGFyZW50O1xuICAgIH07XG5cbiAgICBfcHJvdG8uX2FkZEFyaWFBbmRDb2xsYXBzZWRDbGFzcyA9IGZ1bmN0aW9uIF9hZGRBcmlhQW5kQ29sbGFwc2VkQ2xhc3MoZWxlbWVudCwgdHJpZ2dlckFycmF5KSB7XG4gICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICB2YXIgaXNPcGVuID0gJChlbGVtZW50KS5oYXNDbGFzcyhDbGFzc05hbWUuU0hPVyk7XG5cbiAgICAgICAgaWYgKHRyaWdnZXJBcnJheS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgJCh0cmlnZ2VyQXJyYXkpLnRvZ2dsZUNsYXNzKENsYXNzTmFtZS5DT0xMQVBTRUQsICFpc09wZW4pLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCBpc09wZW4pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTsgLy8gU3RhdGljXG5cblxuICAgIENvbGxhcHNlLl9nZXRUYXJnZXRGcm9tRWxlbWVudCA9IGZ1bmN0aW9uIF9nZXRUYXJnZXRGcm9tRWxlbWVudChlbGVtZW50KSB7XG4gICAgICB2YXIgc2VsZWN0b3IgPSBVdGlsLmdldFNlbGVjdG9yRnJvbUVsZW1lbnQoZWxlbWVudCk7XG4gICAgICByZXR1cm4gc2VsZWN0b3IgPyAkKHNlbGVjdG9yKVswXSA6IG51bGw7XG4gICAgfTtcblxuICAgIENvbGxhcHNlLl9qUXVlcnlJbnRlcmZhY2UgPSBmdW5jdGlvbiBfalF1ZXJ5SW50ZXJmYWNlKGNvbmZpZykge1xuICAgICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciAkdGhpcyA9ICQodGhpcyk7XG4gICAgICAgIHZhciBkYXRhID0gJHRoaXMuZGF0YShEQVRBX0tFWSk7XG5cbiAgICAgICAgdmFyIF9jb25maWcgPSBfZXh0ZW5kcyh7fSwgRGVmYXVsdCwgJHRoaXMuZGF0YSgpLCB0eXBlb2YgY29uZmlnID09PSAnb2JqZWN0JyAmJiBjb25maWcpO1xuXG4gICAgICAgIGlmICghZGF0YSAmJiBfY29uZmlnLnRvZ2dsZSAmJiAvc2hvd3xoaWRlLy50ZXN0KGNvbmZpZykpIHtcbiAgICAgICAgICBfY29uZmlnLnRvZ2dsZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgICAgZGF0YSA9IG5ldyBDb2xsYXBzZSh0aGlzLCBfY29uZmlnKTtcbiAgICAgICAgICAkdGhpcy5kYXRhKERBVEFfS0VZLCBkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGlmICh0eXBlb2YgZGF0YVtjb25maWddID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk5vIG1ldGhvZCBuYW1lZCBcXFwiXCIgKyBjb25maWcgKyBcIlxcXCJcIik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZGF0YVtjb25maWddKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBfY3JlYXRlQ2xhc3MoQ29sbGFwc2UsIG51bGwsIFt7XG4gICAgICBrZXk6IFwiVkVSU0lPTlwiLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBWRVJTSU9OO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIGtleTogXCJEZWZhdWx0XCIsXG4gICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIERlZmF1bHQ7XG4gICAgICB9XG4gICAgfV0pO1xuXG4gICAgcmV0dXJuIENvbGxhcHNlO1xuICB9KCk7XG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogRGF0YSBBcGkgaW1wbGVtZW50YXRpb25cbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgJChkb2N1bWVudCkub24oRXZlbnQuQ0xJQ0tfREFUQV9BUEksIFNlbGVjdG9yLkRBVEFfVE9HR0xFLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAvLyBwcmV2ZW50RGVmYXVsdCBvbmx5IGZvciA8YT4gZWxlbWVudHMgKHdoaWNoIGNoYW5nZSB0aGUgVVJMKSBub3QgaW5zaWRlIHRoZSBjb2xsYXBzaWJsZSBlbGVtZW50XG4gICAgaWYgKGV2ZW50LmN1cnJlbnRUYXJnZXQudGFnTmFtZSA9PT0gJ0EnKSB7XG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cblxuICAgIHZhciAkdHJpZ2dlciA9ICQodGhpcyk7XG4gICAgdmFyIHNlbGVjdG9yID0gVXRpbC5nZXRTZWxlY3RvckZyb21FbGVtZW50KHRoaXMpO1xuICAgICQoc2VsZWN0b3IpLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgdmFyICR0YXJnZXQgPSAkKHRoaXMpO1xuICAgICAgdmFyIGRhdGEgPSAkdGFyZ2V0LmRhdGEoREFUQV9LRVkpO1xuICAgICAgdmFyIGNvbmZpZyA9IGRhdGEgPyAndG9nZ2xlJyA6ICR0cmlnZ2VyLmRhdGEoKTtcblxuICAgICAgQ29sbGFwc2UuX2pRdWVyeUludGVyZmFjZS5jYWxsKCR0YXJnZXQsIGNvbmZpZyk7XG4gICAgfSk7XG4gIH0pO1xuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIGpRdWVyeVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cbiAgJC5mbltOQU1FXSA9IENvbGxhcHNlLl9qUXVlcnlJbnRlcmZhY2U7XG4gICQuZm5bTkFNRV0uQ29uc3RydWN0b3IgPSBDb2xsYXBzZTtcblxuICAkLmZuW05BTUVdLm5vQ29uZmxpY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgJC5mbltOQU1FXSA9IEpRVUVSWV9OT19DT05GTElDVDtcbiAgICByZXR1cm4gQ29sbGFwc2UuX2pRdWVyeUludGVyZmFjZTtcbiAgfTtcblxuICByZXR1cm4gQ29sbGFwc2U7XG59KCQpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29sbGFwc2UuanMubWFwIiwiZnVuY3Rpb24gX2V4dGVuZHMoKSB7IF9leHRlbmRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0KSB7IGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7IHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07IGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHsgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTsgfSB9IH0gcmV0dXJuIHRhcmdldDsgfTsgcmV0dXJuIF9leHRlbmRzLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7IH1cblxuZnVuY3Rpb24gX2RlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfVxuXG5mdW5jdGlvbiBfY3JlYXRlQ2xhc3MoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBfZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIF9kZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfVxuXG4vKipcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCb290c3RyYXAgKHY0LjAuMCk6IGRyb3Bkb3duLmpzXG4gKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21hc3Rlci9MSUNFTlNFKVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqL1xudmFyIERyb3Bkb3duID0gZnVuY3Rpb24gKCQpIHtcbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBDb25zdGFudHNcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuICB2YXIgTkFNRSA9ICdkcm9wZG93bic7XG4gIHZhciBWRVJTSU9OID0gJzQuMC4wJztcbiAgdmFyIERBVEFfS0VZID0gJ2JzLmRyb3Bkb3duJztcbiAgdmFyIEVWRU5UX0tFWSA9IFwiLlwiICsgREFUQV9LRVk7XG4gIHZhciBEQVRBX0FQSV9LRVkgPSAnLmRhdGEtYXBpJztcbiAgdmFyIEpRVUVSWV9OT19DT05GTElDVCA9ICQuZm5bTkFNRV07XG4gIHZhciBFU0NBUEVfS0VZQ09ERSA9IDI3OyAvLyBLZXlib2FyZEV2ZW50LndoaWNoIHZhbHVlIGZvciBFc2NhcGUgKEVzYykga2V5XG5cbiAgdmFyIFNQQUNFX0tFWUNPREUgPSAzMjsgLy8gS2V5Ym9hcmRFdmVudC53aGljaCB2YWx1ZSBmb3Igc3BhY2Uga2V5XG5cbiAgdmFyIFRBQl9LRVlDT0RFID0gOTsgLy8gS2V5Ym9hcmRFdmVudC53aGljaCB2YWx1ZSBmb3IgdGFiIGtleVxuXG4gIHZhciBBUlJPV19VUF9LRVlDT0RFID0gMzg7IC8vIEtleWJvYXJkRXZlbnQud2hpY2ggdmFsdWUgZm9yIHVwIGFycm93IGtleVxuXG4gIHZhciBBUlJPV19ET1dOX0tFWUNPREUgPSA0MDsgLy8gS2V5Ym9hcmRFdmVudC53aGljaCB2YWx1ZSBmb3IgZG93biBhcnJvdyBrZXlcblxuICB2YXIgUklHSFRfTU9VU0VfQlVUVE9OX1dISUNIID0gMzsgLy8gTW91c2VFdmVudC53aGljaCB2YWx1ZSBmb3IgdGhlIHJpZ2h0IGJ1dHRvbiAoYXNzdW1pbmcgYSByaWdodC1oYW5kZWQgbW91c2UpXG5cbiAgdmFyIFJFR0VYUF9LRVlET1dOID0gbmV3IFJlZ0V4cChBUlJPV19VUF9LRVlDT0RFICsgXCJ8XCIgKyBBUlJPV19ET1dOX0tFWUNPREUgKyBcInxcIiArIEVTQ0FQRV9LRVlDT0RFKTtcbiAgdmFyIEV2ZW50ID0ge1xuICAgIEhJREU6IFwiaGlkZVwiICsgRVZFTlRfS0VZLFxuICAgIEhJRERFTjogXCJoaWRkZW5cIiArIEVWRU5UX0tFWSxcbiAgICBTSE9XOiBcInNob3dcIiArIEVWRU5UX0tFWSxcbiAgICBTSE9XTjogXCJzaG93blwiICsgRVZFTlRfS0VZLFxuICAgIENMSUNLOiBcImNsaWNrXCIgKyBFVkVOVF9LRVksXG4gICAgQ0xJQ0tfREFUQV9BUEk6IFwiY2xpY2tcIiArIEVWRU5UX0tFWSArIERBVEFfQVBJX0tFWSxcbiAgICBLRVlET1dOX0RBVEFfQVBJOiBcImtleWRvd25cIiArIEVWRU5UX0tFWSArIERBVEFfQVBJX0tFWSxcbiAgICBLRVlVUF9EQVRBX0FQSTogXCJrZXl1cFwiICsgRVZFTlRfS0VZICsgREFUQV9BUElfS0VZXG4gIH07XG4gIHZhciBDbGFzc05hbWUgPSB7XG4gICAgRElTQUJMRUQ6ICdkaXNhYmxlZCcsXG4gICAgU0hPVzogJ3Nob3cnLFxuICAgIERST1BVUDogJ2Ryb3B1cCcsXG4gICAgRFJPUFJJR0hUOiAnZHJvcHJpZ2h0JyxcbiAgICBEUk9QTEVGVDogJ2Ryb3BsZWZ0JyxcbiAgICBNRU5VUklHSFQ6ICdkcm9wZG93bi1tZW51LXJpZ2h0JyxcbiAgICBNRU5VTEVGVDogJ2Ryb3Bkb3duLW1lbnUtbGVmdCcsXG4gICAgUE9TSVRJT05fU1RBVElDOiAncG9zaXRpb24tc3RhdGljJ1xuICB9O1xuICB2YXIgU2VsZWN0b3IgPSB7XG4gICAgREFUQV9UT0dHTEU6ICdbZGF0YS10b2dnbGU9XCJkcm9wZG93blwiXScsXG4gICAgRk9STV9DSElMRDogJy5kcm9wZG93biBmb3JtJyxcbiAgICBNRU5VOiAnLmRyb3Bkb3duLW1lbnUnLFxuICAgIE5BVkJBUl9OQVY6ICcubmF2YmFyLW5hdicsXG4gICAgVklTSUJMRV9JVEVNUzogJy5kcm9wZG93bi1tZW51IC5kcm9wZG93bi1pdGVtOm5vdCguZGlzYWJsZWQpJ1xuICB9O1xuICB2YXIgQXR0YWNobWVudE1hcCA9IHtcbiAgICBUT1A6ICd0b3Atc3RhcnQnLFxuICAgIFRPUEVORDogJ3RvcC1lbmQnLFxuICAgIEJPVFRPTTogJ2JvdHRvbS1zdGFydCcsXG4gICAgQk9UVE9NRU5EOiAnYm90dG9tLWVuZCcsXG4gICAgUklHSFQ6ICdyaWdodC1zdGFydCcsXG4gICAgUklHSFRFTkQ6ICdyaWdodC1lbmQnLFxuICAgIExFRlQ6ICdsZWZ0LXN0YXJ0JyxcbiAgICBMRUZURU5EOiAnbGVmdC1lbmQnXG4gIH07XG4gIHZhciBEZWZhdWx0ID0ge1xuICAgIG9mZnNldDogMCxcbiAgICBmbGlwOiB0cnVlLFxuICAgIGJvdW5kYXJ5OiAnc2Nyb2xsUGFyZW50J1xuICB9O1xuICB2YXIgRGVmYXVsdFR5cGUgPSB7XG4gICAgb2Zmc2V0OiAnKG51bWJlcnxzdHJpbmd8ZnVuY3Rpb24pJyxcbiAgICBmbGlwOiAnYm9vbGVhbicsXG4gICAgYm91bmRhcnk6ICcoc3RyaW5nfGVsZW1lbnQpJ1xuICAgIC8qKlxuICAgICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAqIENsYXNzIERlZmluaXRpb25cbiAgICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgKi9cblxuICB9O1xuXG4gIHZhciBEcm9wZG93biA9XG4gIC8qI19fUFVSRV9fKi9cbiAgZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIERyb3Bkb3duKGVsZW1lbnQsIGNvbmZpZykge1xuICAgICAgdGhpcy5fZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgICB0aGlzLl9wb3BwZXIgPSBudWxsO1xuICAgICAgdGhpcy5fY29uZmlnID0gdGhpcy5fZ2V0Q29uZmlnKGNvbmZpZyk7XG4gICAgICB0aGlzLl9tZW51ID0gdGhpcy5fZ2V0TWVudUVsZW1lbnQoKTtcbiAgICAgIHRoaXMuX2luTmF2YmFyID0gdGhpcy5fZGV0ZWN0TmF2YmFyKCk7XG5cbiAgICAgIHRoaXMuX2FkZEV2ZW50TGlzdGVuZXJzKCk7XG4gICAgfSAvLyBHZXR0ZXJzXG5cblxuICAgIHZhciBfcHJvdG8gPSBEcm9wZG93bi5wcm90b3R5cGU7XG5cbiAgICAvLyBQdWJsaWNcbiAgICBfcHJvdG8udG9nZ2xlID0gZnVuY3Rpb24gdG9nZ2xlKCkge1xuICAgICAgaWYgKHRoaXMuX2VsZW1lbnQuZGlzYWJsZWQgfHwgJCh0aGlzLl9lbGVtZW50KS5oYXNDbGFzcyhDbGFzc05hbWUuRElTQUJMRUQpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIHBhcmVudCA9IERyb3Bkb3duLl9nZXRQYXJlbnRGcm9tRWxlbWVudCh0aGlzLl9lbGVtZW50KTtcblxuICAgICAgdmFyIGlzQWN0aXZlID0gJCh0aGlzLl9tZW51KS5oYXNDbGFzcyhDbGFzc05hbWUuU0hPVyk7XG5cbiAgICAgIERyb3Bkb3duLl9jbGVhck1lbnVzKCk7XG5cbiAgICAgIGlmIChpc0FjdGl2ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciByZWxhdGVkVGFyZ2V0ID0ge1xuICAgICAgICByZWxhdGVkVGFyZ2V0OiB0aGlzLl9lbGVtZW50XG4gICAgICB9O1xuICAgICAgdmFyIHNob3dFdmVudCA9ICQuRXZlbnQoRXZlbnQuU0hPVywgcmVsYXRlZFRhcmdldCk7XG4gICAgICAkKHBhcmVudCkudHJpZ2dlcihzaG93RXZlbnQpO1xuXG4gICAgICBpZiAoc2hvd0V2ZW50LmlzRGVmYXVsdFByZXZlbnRlZCgpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gLy8gRGlzYWJsZSB0b3RhbGx5IFBvcHBlci5qcyBmb3IgRHJvcGRvd24gaW4gTmF2YmFyXG5cblxuICAgICAgaWYgKCF0aGlzLl9pbk5hdmJhcikge1xuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgZm9yIFBvcHBlciBkZXBlbmRlbmN5XG4gICAgICAgICAqIFBvcHBlciAtIGh0dHBzOi8vcG9wcGVyLmpzLm9yZ1xuICAgICAgICAgKi9cbiAgICAgICAgaWYgKHR5cGVvZiBQb3BwZXIgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQm9vdHN0cmFwIGRyb3Bkb3duIHJlcXVpcmUgUG9wcGVyLmpzIChodHRwczovL3BvcHBlci5qcy5vcmcpJyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7IC8vIEZvciBkcm9wdXAgd2l0aCBhbGlnbm1lbnQgd2UgdXNlIHRoZSBwYXJlbnQgYXMgcG9wcGVyIGNvbnRhaW5lclxuXG4gICAgICAgIGlmICgkKHBhcmVudCkuaGFzQ2xhc3MoQ2xhc3NOYW1lLkRST1BVUCkpIHtcbiAgICAgICAgICBpZiAoJCh0aGlzLl9tZW51KS5oYXNDbGFzcyhDbGFzc05hbWUuTUVOVUxFRlQpIHx8ICQodGhpcy5fbWVudSkuaGFzQ2xhc3MoQ2xhc3NOYW1lLk1FTlVSSUdIVCkpIHtcbiAgICAgICAgICAgIGVsZW1lbnQgPSBwYXJlbnQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IC8vIElmIGJvdW5kYXJ5IGlzIG5vdCBgc2Nyb2xsUGFyZW50YCwgdGhlbiBzZXQgcG9zaXRpb24gdG8gYHN0YXRpY2BcbiAgICAgICAgLy8gdG8gYWxsb3cgdGhlIG1lbnUgdG8gXCJlc2NhcGVcIiB0aGUgc2Nyb2xsIHBhcmVudCdzIGJvdW5kYXJpZXNcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2lzc3Vlcy8yNDI1MVxuXG5cbiAgICAgICAgaWYgKHRoaXMuX2NvbmZpZy5ib3VuZGFyeSAhPT0gJ3Njcm9sbFBhcmVudCcpIHtcbiAgICAgICAgICAkKHBhcmVudCkuYWRkQ2xhc3MoQ2xhc3NOYW1lLlBPU0lUSU9OX1NUQVRJQyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9wb3BwZXIgPSBuZXcgUG9wcGVyKGVsZW1lbnQsIHRoaXMuX21lbnUsIHRoaXMuX2dldFBvcHBlckNvbmZpZygpKTtcbiAgICAgIH0gLy8gSWYgdGhpcyBpcyBhIHRvdWNoLWVuYWJsZWQgZGV2aWNlIHdlIGFkZCBleHRyYVxuICAgICAgLy8gZW1wdHkgbW91c2VvdmVyIGxpc3RlbmVycyB0byB0aGUgYm9keSdzIGltbWVkaWF0ZSBjaGlsZHJlbjtcbiAgICAgIC8vIG9ubHkgbmVlZGVkIGJlY2F1c2Ugb2YgYnJva2VuIGV2ZW50IGRlbGVnYXRpb24gb24gaU9TXG4gICAgICAvLyBodHRwczovL3d3dy5xdWlya3Ntb2RlLm9yZy9ibG9nL2FyY2hpdmVzLzIwMTQvMDIvbW91c2VfZXZlbnRfYnViLmh0bWxcblxuXG4gICAgICBpZiAoJ29udG91Y2hzdGFydCcgaW4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmICQocGFyZW50KS5jbG9zZXN0KFNlbGVjdG9yLk5BVkJBUl9OQVYpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAkKCdib2R5JykuY2hpbGRyZW4oKS5vbignbW91c2VvdmVyJywgbnVsbCwgJC5ub29wKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fZWxlbWVudC5mb2N1cygpO1xuXG4gICAgICB0aGlzLl9lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIHRydWUpO1xuXG4gICAgICAkKHRoaXMuX21lbnUpLnRvZ2dsZUNsYXNzKENsYXNzTmFtZS5TSE9XKTtcbiAgICAgICQocGFyZW50KS50b2dnbGVDbGFzcyhDbGFzc05hbWUuU0hPVykudHJpZ2dlcigkLkV2ZW50KEV2ZW50LlNIT1dOLCByZWxhdGVkVGFyZ2V0KSk7XG4gICAgfTtcblxuICAgIF9wcm90by5kaXNwb3NlID0gZnVuY3Rpb24gZGlzcG9zZSgpIHtcbiAgICAgICQucmVtb3ZlRGF0YSh0aGlzLl9lbGVtZW50LCBEQVRBX0tFWSk7XG4gICAgICAkKHRoaXMuX2VsZW1lbnQpLm9mZihFVkVOVF9LRVkpO1xuICAgICAgdGhpcy5fZWxlbWVudCA9IG51bGw7XG4gICAgICB0aGlzLl9tZW51ID0gbnVsbDtcblxuICAgICAgaWYgKHRoaXMuX3BvcHBlciAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLl9wb3BwZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMuX3BvcHBlciA9IG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIF9wcm90by51cGRhdGUgPSBmdW5jdGlvbiB1cGRhdGUoKSB7XG4gICAgICB0aGlzLl9pbk5hdmJhciA9IHRoaXMuX2RldGVjdE5hdmJhcigpO1xuXG4gICAgICBpZiAodGhpcy5fcG9wcGVyICE9PSBudWxsKSB7XG4gICAgICAgIHRoaXMuX3BvcHBlci5zY2hlZHVsZVVwZGF0ZSgpO1xuICAgICAgfVxuICAgIH07IC8vIFByaXZhdGVcblxuXG4gICAgX3Byb3RvLl9hZGRFdmVudExpc3RlbmVycyA9IGZ1bmN0aW9uIF9hZGRFdmVudExpc3RlbmVycygpIHtcbiAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgICQodGhpcy5fZWxlbWVudCkub24oRXZlbnQuQ0xJQ0ssIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblxuICAgICAgICBfdGhpcy50b2dnbGUoKTtcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBfcHJvdG8uX2dldENvbmZpZyA9IGZ1bmN0aW9uIF9nZXRDb25maWcoY29uZmlnKSB7XG4gICAgICBjb25maWcgPSBfZXh0ZW5kcyh7fSwgdGhpcy5jb25zdHJ1Y3Rvci5EZWZhdWx0LCAkKHRoaXMuX2VsZW1lbnQpLmRhdGEoKSwgY29uZmlnKTtcbiAgICAgIFV0aWwudHlwZUNoZWNrQ29uZmlnKE5BTUUsIGNvbmZpZywgdGhpcy5jb25zdHJ1Y3Rvci5EZWZhdWx0VHlwZSk7XG4gICAgICByZXR1cm4gY29uZmlnO1xuICAgIH07XG5cbiAgICBfcHJvdG8uX2dldE1lbnVFbGVtZW50ID0gZnVuY3Rpb24gX2dldE1lbnVFbGVtZW50KCkge1xuICAgICAgaWYgKCF0aGlzLl9tZW51KSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBEcm9wZG93bi5fZ2V0UGFyZW50RnJvbUVsZW1lbnQodGhpcy5fZWxlbWVudCk7XG5cbiAgICAgICAgdGhpcy5fbWVudSA9ICQocGFyZW50KS5maW5kKFNlbGVjdG9yLk1FTlUpWzBdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fbWVudTtcbiAgICB9O1xuXG4gICAgX3Byb3RvLl9nZXRQbGFjZW1lbnQgPSBmdW5jdGlvbiBfZ2V0UGxhY2VtZW50KCkge1xuICAgICAgdmFyICRwYXJlbnREcm9wZG93biA9ICQodGhpcy5fZWxlbWVudCkucGFyZW50KCk7XG4gICAgICB2YXIgcGxhY2VtZW50ID0gQXR0YWNobWVudE1hcC5CT1RUT007IC8vIEhhbmRsZSBkcm9wdXBcblxuICAgICAgaWYgKCRwYXJlbnREcm9wZG93bi5oYXNDbGFzcyhDbGFzc05hbWUuRFJPUFVQKSkge1xuICAgICAgICBwbGFjZW1lbnQgPSBBdHRhY2htZW50TWFwLlRPUDtcblxuICAgICAgICBpZiAoJCh0aGlzLl9tZW51KS5oYXNDbGFzcyhDbGFzc05hbWUuTUVOVVJJR0hUKSkge1xuICAgICAgICAgIHBsYWNlbWVudCA9IEF0dGFjaG1lbnRNYXAuVE9QRU5EO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCRwYXJlbnREcm9wZG93bi5oYXNDbGFzcyhDbGFzc05hbWUuRFJPUFJJR0hUKSkge1xuICAgICAgICBwbGFjZW1lbnQgPSBBdHRhY2htZW50TWFwLlJJR0hUO1xuICAgICAgfSBlbHNlIGlmICgkcGFyZW50RHJvcGRvd24uaGFzQ2xhc3MoQ2xhc3NOYW1lLkRST1BMRUZUKSkge1xuICAgICAgICBwbGFjZW1lbnQgPSBBdHRhY2htZW50TWFwLkxFRlQ7XG4gICAgICB9IGVsc2UgaWYgKCQodGhpcy5fbWVudSkuaGFzQ2xhc3MoQ2xhc3NOYW1lLk1FTlVSSUdIVCkpIHtcbiAgICAgICAgcGxhY2VtZW50ID0gQXR0YWNobWVudE1hcC5CT1RUT01FTkQ7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwbGFjZW1lbnQ7XG4gICAgfTtcblxuICAgIF9wcm90by5fZGV0ZWN0TmF2YmFyID0gZnVuY3Rpb24gX2RldGVjdE5hdmJhcigpIHtcbiAgICAgIHJldHVybiAkKHRoaXMuX2VsZW1lbnQpLmNsb3Nlc3QoJy5uYXZiYXInKS5sZW5ndGggPiAwO1xuICAgIH07XG5cbiAgICBfcHJvdG8uX2dldFBvcHBlckNvbmZpZyA9IGZ1bmN0aW9uIF9nZXRQb3BwZXJDb25maWcoKSB7XG4gICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgdmFyIG9mZnNldENvbmYgPSB7fTtcblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLl9jb25maWcub2Zmc2V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG9mZnNldENvbmYuZm4gPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgIGRhdGEub2Zmc2V0cyA9IF9leHRlbmRzKHt9LCBkYXRhLm9mZnNldHMsIF90aGlzMi5fY29uZmlnLm9mZnNldChkYXRhLm9mZnNldHMpIHx8IHt9KTtcbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9mZnNldENvbmYub2Zmc2V0ID0gdGhpcy5fY29uZmlnLm9mZnNldDtcbiAgICAgIH1cblxuICAgICAgdmFyIHBvcHBlckNvbmZpZyA9IHtcbiAgICAgICAgcGxhY2VtZW50OiB0aGlzLl9nZXRQbGFjZW1lbnQoKSxcbiAgICAgICAgbW9kaWZpZXJzOiB7XG4gICAgICAgICAgb2Zmc2V0OiBvZmZzZXRDb25mLFxuICAgICAgICAgIGZsaXA6IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRoaXMuX2NvbmZpZy5mbGlwXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmV2ZW50T3ZlcmZsb3c6IHtcbiAgICAgICAgICAgIGJvdW5kYXJpZXNFbGVtZW50OiB0aGlzLl9jb25maWcuYm91bmRhcnlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICByZXR1cm4gcG9wcGVyQ29uZmlnO1xuICAgIH07IC8vIFN0YXRpY1xuXG5cbiAgICBEcm9wZG93bi5falF1ZXJ5SW50ZXJmYWNlID0gZnVuY3Rpb24gX2pRdWVyeUludGVyZmFjZShjb25maWcpIHtcbiAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZGF0YSA9ICQodGhpcykuZGF0YShEQVRBX0tFWSk7XG5cbiAgICAgICAgdmFyIF9jb25maWcgPSB0eXBlb2YgY29uZmlnID09PSAnb2JqZWN0JyA/IGNvbmZpZyA6IG51bGw7XG5cbiAgICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgICAgZGF0YSA9IG5ldyBEcm9wZG93bih0aGlzLCBfY29uZmlnKTtcbiAgICAgICAgICAkKHRoaXMpLmRhdGEoREFUQV9LRVksIGRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBjb25maWcgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgaWYgKHR5cGVvZiBkYXRhW2NvbmZpZ10gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiTm8gbWV0aG9kIG5hbWVkIFxcXCJcIiArIGNvbmZpZyArIFwiXFxcIlwiKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBkYXRhW2NvbmZpZ10oKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIERyb3Bkb3duLl9jbGVhck1lbnVzID0gZnVuY3Rpb24gX2NsZWFyTWVudXMoZXZlbnQpIHtcbiAgICAgIGlmIChldmVudCAmJiAoZXZlbnQud2hpY2ggPT09IFJJR0hUX01PVVNFX0JVVFRPTl9XSElDSCB8fCBldmVudC50eXBlID09PSAna2V5dXAnICYmIGV2ZW50LndoaWNoICE9PSBUQUJfS0VZQ09ERSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgdG9nZ2xlcyA9ICQubWFrZUFycmF5KCQoU2VsZWN0b3IuREFUQV9UT0dHTEUpKTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b2dnbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBEcm9wZG93bi5fZ2V0UGFyZW50RnJvbUVsZW1lbnQodG9nZ2xlc1tpXSk7XG5cbiAgICAgICAgdmFyIGNvbnRleHQgPSAkKHRvZ2dsZXNbaV0pLmRhdGEoREFUQV9LRVkpO1xuICAgICAgICB2YXIgcmVsYXRlZFRhcmdldCA9IHtcbiAgICAgICAgICByZWxhdGVkVGFyZ2V0OiB0b2dnbGVzW2ldXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKCFjb250ZXh0KSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZHJvcGRvd25NZW51ID0gY29udGV4dC5fbWVudTtcblxuICAgICAgICBpZiAoISQocGFyZW50KS5oYXNDbGFzcyhDbGFzc05hbWUuU0hPVykpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudCAmJiAoZXZlbnQudHlwZSA9PT0gJ2NsaWNrJyAmJiAvaW5wdXR8dGV4dGFyZWEvaS50ZXN0KGV2ZW50LnRhcmdldC50YWdOYW1lKSB8fCBldmVudC50eXBlID09PSAna2V5dXAnICYmIGV2ZW50LndoaWNoID09PSBUQUJfS0VZQ09ERSkgJiYgJC5jb250YWlucyhwYXJlbnQsIGV2ZW50LnRhcmdldCkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBoaWRlRXZlbnQgPSAkLkV2ZW50KEV2ZW50LkhJREUsIHJlbGF0ZWRUYXJnZXQpO1xuICAgICAgICAkKHBhcmVudCkudHJpZ2dlcihoaWRlRXZlbnQpO1xuXG4gICAgICAgIGlmIChoaWRlRXZlbnQuaXNEZWZhdWx0UHJldmVudGVkKCkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSAvLyBJZiB0aGlzIGlzIGEgdG91Y2gtZW5hYmxlZCBkZXZpY2Ugd2UgcmVtb3ZlIHRoZSBleHRyYVxuICAgICAgICAvLyBlbXB0eSBtb3VzZW92ZXIgbGlzdGVuZXJzIHdlIGFkZGVkIGZvciBpT1Mgc3VwcG9ydFxuXG5cbiAgICAgICAgaWYgKCdvbnRvdWNoc3RhcnQnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkge1xuICAgICAgICAgICQoJ2JvZHknKS5jaGlsZHJlbigpLm9mZignbW91c2VvdmVyJywgbnVsbCwgJC5ub29wKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRvZ2dsZXNbaV0uc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG4gICAgICAgICQoZHJvcGRvd25NZW51KS5yZW1vdmVDbGFzcyhDbGFzc05hbWUuU0hPVyk7XG4gICAgICAgICQocGFyZW50KS5yZW1vdmVDbGFzcyhDbGFzc05hbWUuU0hPVykudHJpZ2dlcigkLkV2ZW50KEV2ZW50LkhJRERFTiwgcmVsYXRlZFRhcmdldCkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBEcm9wZG93bi5fZ2V0UGFyZW50RnJvbUVsZW1lbnQgPSBmdW5jdGlvbiBfZ2V0UGFyZW50RnJvbUVsZW1lbnQoZWxlbWVudCkge1xuICAgICAgdmFyIHBhcmVudDtcbiAgICAgIHZhciBzZWxlY3RvciA9IFV0aWwuZ2V0U2VsZWN0b3JGcm9tRWxlbWVudChlbGVtZW50KTtcblxuICAgICAgaWYgKHNlbGVjdG9yKSB7XG4gICAgICAgIHBhcmVudCA9ICQoc2VsZWN0b3IpWzBdO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGFyZW50IHx8IGVsZW1lbnQucGFyZW50Tm9kZTtcbiAgICB9OyAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY29tcGxleGl0eVxuXG5cbiAgICBEcm9wZG93bi5fZGF0YUFwaUtleWRvd25IYW5kbGVyID0gZnVuY3Rpb24gX2RhdGFBcGlLZXlkb3duSGFuZGxlcihldmVudCkge1xuICAgICAgLy8gSWYgbm90IGlucHV0L3RleHRhcmVhOlxuICAgICAgLy8gIC0gQW5kIG5vdCBhIGtleSBpbiBSRUdFWFBfS0VZRE9XTiA9PiBub3QgYSBkcm9wZG93biBjb21tYW5kXG4gICAgICAvLyBJZiBpbnB1dC90ZXh0YXJlYTpcbiAgICAgIC8vICAtIElmIHNwYWNlIGtleSA9PiBub3QgYSBkcm9wZG93biBjb21tYW5kXG4gICAgICAvLyAgLSBJZiBrZXkgaXMgb3RoZXIgdGhhbiBlc2NhcGVcbiAgICAgIC8vICAgIC0gSWYga2V5IGlzIG5vdCB1cCBvciBkb3duID0+IG5vdCBhIGRyb3Bkb3duIGNvbW1hbmRcbiAgICAgIC8vICAgIC0gSWYgdHJpZ2dlciBpbnNpZGUgdGhlIG1lbnUgPT4gbm90IGEgZHJvcGRvd24gY29tbWFuZFxuICAgICAgaWYgKC9pbnB1dHx0ZXh0YXJlYS9pLnRlc3QoZXZlbnQudGFyZ2V0LnRhZ05hbWUpID8gZXZlbnQud2hpY2ggPT09IFNQQUNFX0tFWUNPREUgfHwgZXZlbnQud2hpY2ggIT09IEVTQ0FQRV9LRVlDT0RFICYmIChldmVudC53aGljaCAhPT0gQVJST1dfRE9XTl9LRVlDT0RFICYmIGV2ZW50LndoaWNoICE9PSBBUlJPV19VUF9LRVlDT0RFIHx8ICQoZXZlbnQudGFyZ2V0KS5jbG9zZXN0KFNlbGVjdG9yLk1FTlUpLmxlbmd0aCkgOiAhUkVHRVhQX0tFWURPV04udGVzdChldmVudC53aGljaCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICAgIGlmICh0aGlzLmRpc2FibGVkIHx8ICQodGhpcykuaGFzQ2xhc3MoQ2xhc3NOYW1lLkRJU0FCTEVEKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciBwYXJlbnQgPSBEcm9wZG93bi5fZ2V0UGFyZW50RnJvbUVsZW1lbnQodGhpcyk7XG5cbiAgICAgIHZhciBpc0FjdGl2ZSA9ICQocGFyZW50KS5oYXNDbGFzcyhDbGFzc05hbWUuU0hPVyk7XG5cbiAgICAgIGlmICghaXNBY3RpdmUgJiYgKGV2ZW50LndoaWNoICE9PSBFU0NBUEVfS0VZQ09ERSB8fCBldmVudC53aGljaCAhPT0gU1BBQ0VfS0VZQ09ERSkgfHwgaXNBY3RpdmUgJiYgKGV2ZW50LndoaWNoID09PSBFU0NBUEVfS0VZQ09ERSB8fCBldmVudC53aGljaCA9PT0gU1BBQ0VfS0VZQ09ERSkpIHtcbiAgICAgICAgaWYgKGV2ZW50LndoaWNoID09PSBFU0NBUEVfS0VZQ09ERSkge1xuICAgICAgICAgIHZhciB0b2dnbGUgPSAkKHBhcmVudCkuZmluZChTZWxlY3Rvci5EQVRBX1RPR0dMRSlbMF07XG4gICAgICAgICAgJCh0b2dnbGUpLnRyaWdnZXIoJ2ZvY3VzJyk7XG4gICAgICAgIH1cblxuICAgICAgICAkKHRoaXMpLnRyaWdnZXIoJ2NsaWNrJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIGl0ZW1zID0gJChwYXJlbnQpLmZpbmQoU2VsZWN0b3IuVklTSUJMRV9JVEVNUykuZ2V0KCk7XG5cbiAgICAgIGlmIChpdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgaW5kZXggPSBpdGVtcy5pbmRleE9mKGV2ZW50LnRhcmdldCk7XG5cbiAgICAgIGlmIChldmVudC53aGljaCA9PT0gQVJST1dfVVBfS0VZQ09ERSAmJiBpbmRleCA+IDApIHtcbiAgICAgICAgLy8gVXBcbiAgICAgICAgaW5kZXgtLTtcbiAgICAgIH1cblxuICAgICAgaWYgKGV2ZW50LndoaWNoID09PSBBUlJPV19ET1dOX0tFWUNPREUgJiYgaW5kZXggPCBpdGVtcy5sZW5ndGggLSAxKSB7XG4gICAgICAgIC8vIERvd25cbiAgICAgICAgaW5kZXgrKztcbiAgICAgIH1cblxuICAgICAgaWYgKGluZGV4IDwgMCkge1xuICAgICAgICBpbmRleCA9IDA7XG4gICAgICB9XG5cbiAgICAgIGl0ZW1zW2luZGV4XS5mb2N1cygpO1xuICAgIH07XG5cbiAgICBfY3JlYXRlQ2xhc3MoRHJvcGRvd24sIG51bGwsIFt7XG4gICAgICBrZXk6IFwiVkVSU0lPTlwiLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBWRVJTSU9OO1xuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIGtleTogXCJEZWZhdWx0XCIsXG4gICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIERlZmF1bHQ7XG4gICAgICB9XG4gICAgfSwge1xuICAgICAga2V5OiBcIkRlZmF1bHRUeXBlXCIsXG4gICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIERlZmF1bHRUeXBlO1xuICAgICAgfVxuICAgIH1dKTtcblxuICAgIHJldHVybiBEcm9wZG93bjtcbiAgfSgpO1xuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIERhdGEgQXBpIGltcGxlbWVudGF0aW9uXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuXG4gICQoZG9jdW1lbnQpLm9uKEV2ZW50LktFWURPV05fREFUQV9BUEksIFNlbGVjdG9yLkRBVEFfVE9HR0xFLCBEcm9wZG93bi5fZGF0YUFwaUtleWRvd25IYW5kbGVyKS5vbihFdmVudC5LRVlET1dOX0RBVEFfQVBJLCBTZWxlY3Rvci5NRU5VLCBEcm9wZG93bi5fZGF0YUFwaUtleWRvd25IYW5kbGVyKS5vbihFdmVudC5DTElDS19EQVRBX0FQSSArIFwiIFwiICsgRXZlbnQuS0VZVVBfREFUQV9BUEksIERyb3Bkb3duLl9jbGVhck1lbnVzKS5vbihFdmVudC5DTElDS19EQVRBX0FQSSwgU2VsZWN0b3IuREFUQV9UT0dHTEUsIGZ1bmN0aW9uIChldmVudCkge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cbiAgICBEcm9wZG93bi5falF1ZXJ5SW50ZXJmYWNlLmNhbGwoJCh0aGlzKSwgJ3RvZ2dsZScpO1xuICB9KS5vbihFdmVudC5DTElDS19EQVRBX0FQSSwgU2VsZWN0b3IuRk9STV9DSElMRCwgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICB9KTtcbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBqUXVlcnlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG4gICQuZm5bTkFNRV0gPSBEcm9wZG93bi5falF1ZXJ5SW50ZXJmYWNlO1xuICAkLmZuW05BTUVdLkNvbnN0cnVjdG9yID0gRHJvcGRvd247XG5cbiAgJC5mbltOQU1FXS5ub0NvbmZsaWN0ID0gZnVuY3Rpb24gKCkge1xuICAgICQuZm5bTkFNRV0gPSBKUVVFUllfTk9fQ09ORkxJQ1Q7XG4gICAgcmV0dXJuIERyb3Bkb3duLl9qUXVlcnlJbnRlcmZhY2U7XG4gIH07XG5cbiAgcmV0dXJuIERyb3Bkb3duO1xufSgkLCBQb3BwZXIpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZHJvcGRvd24uanMubWFwIiwiZnVuY3Rpb24gX2V4dGVuZHMoKSB7IF9leHRlbmRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0KSB7IGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7IHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07IGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHsgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTsgfSB9IH0gcmV0dXJuIHRhcmdldDsgfTsgcmV0dXJuIF9leHRlbmRzLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7IH1cblxuZnVuY3Rpb24gX2RlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoXCJ2YWx1ZVwiIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfVxuXG5mdW5jdGlvbiBfY3JlYXRlQ2xhc3MoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBfZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIF9kZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfVxuXG4vKipcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBCb290c3RyYXAgKHY0LjAuMCk6IHNjcm9sbHNweS5qc1xuICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYXN0ZXIvTElDRU5TRSlcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKi9cbnZhciBTY3JvbGxTcHkgPSBmdW5jdGlvbiAoJCkge1xuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIENvbnN0YW50c1xuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG4gIHZhciBOQU1FID0gJ3Njcm9sbHNweSc7XG4gIHZhciBWRVJTSU9OID0gJzQuMC4wJztcbiAgdmFyIERBVEFfS0VZID0gJ2JzLnNjcm9sbHNweSc7XG4gIHZhciBFVkVOVF9LRVkgPSBcIi5cIiArIERBVEFfS0VZO1xuICB2YXIgREFUQV9BUElfS0VZID0gJy5kYXRhLWFwaSc7XG4gIHZhciBKUVVFUllfTk9fQ09ORkxJQ1QgPSAkLmZuW05BTUVdO1xuICB2YXIgRGVmYXVsdCA9IHtcbiAgICBvZmZzZXQ6IDEwLFxuICAgIG1ldGhvZDogJ2F1dG8nLFxuICAgIHRhcmdldDogJydcbiAgfTtcbiAgdmFyIERlZmF1bHRUeXBlID0ge1xuICAgIG9mZnNldDogJ251bWJlcicsXG4gICAgbWV0aG9kOiAnc3RyaW5nJyxcbiAgICB0YXJnZXQ6ICcoc3RyaW5nfGVsZW1lbnQpJ1xuICB9O1xuICB2YXIgRXZlbnQgPSB7XG4gICAgQUNUSVZBVEU6IFwiYWN0aXZhdGVcIiArIEVWRU5UX0tFWSxcbiAgICBTQ1JPTEw6IFwic2Nyb2xsXCIgKyBFVkVOVF9LRVksXG4gICAgTE9BRF9EQVRBX0FQSTogXCJsb2FkXCIgKyBFVkVOVF9LRVkgKyBEQVRBX0FQSV9LRVlcbiAgfTtcbiAgdmFyIENsYXNzTmFtZSA9IHtcbiAgICBEUk9QRE9XTl9JVEVNOiAnZHJvcGRvd24taXRlbScsXG4gICAgRFJPUERPV05fTUVOVTogJ2Ryb3Bkb3duLW1lbnUnLFxuICAgIEFDVElWRTogJ2FjdGl2ZSdcbiAgfTtcbiAgdmFyIFNlbGVjdG9yID0ge1xuICAgIERBVEFfU1BZOiAnW2RhdGEtc3B5PVwic2Nyb2xsXCJdJyxcbiAgICBBQ1RJVkU6ICcuYWN0aXZlJyxcbiAgICBOQVZfTElTVF9HUk9VUDogJy5uYXYsIC5saXN0LWdyb3VwJyxcbiAgICBOQVZfTElOS1M6ICcubmF2LWxpbmsnLFxuICAgIE5BVl9JVEVNUzogJy5uYXYtaXRlbScsXG4gICAgTElTVF9JVEVNUzogJy5saXN0LWdyb3VwLWl0ZW0nLFxuICAgIERST1BET1dOOiAnLmRyb3Bkb3duJyxcbiAgICBEUk9QRE9XTl9JVEVNUzogJy5kcm9wZG93bi1pdGVtJyxcbiAgICBEUk9QRE9XTl9UT0dHTEU6ICcuZHJvcGRvd24tdG9nZ2xlJ1xuICB9O1xuICB2YXIgT2Zmc2V0TWV0aG9kID0ge1xuICAgIE9GRlNFVDogJ29mZnNldCcsXG4gICAgUE9TSVRJT046ICdwb3NpdGlvbidcbiAgICAvKipcbiAgICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgKiBDbGFzcyBEZWZpbml0aW9uXG4gICAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICovXG5cbiAgfTtcblxuICB2YXIgU2Nyb2xsU3B5ID1cbiAgLyojX19QVVJFX18qL1xuICBmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gU2Nyb2xsU3B5KGVsZW1lbnQsIGNvbmZpZykge1xuICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgdGhpcy5fZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgICB0aGlzLl9zY3JvbGxFbGVtZW50ID0gZWxlbWVudC50YWdOYW1lID09PSAnQk9EWScgPyB3aW5kb3cgOiBlbGVtZW50O1xuICAgICAgdGhpcy5fY29uZmlnID0gdGhpcy5fZ2V0Q29uZmlnKGNvbmZpZyk7XG4gICAgICB0aGlzLl9zZWxlY3RvciA9IHRoaXMuX2NvbmZpZy50YXJnZXQgKyBcIiBcIiArIFNlbGVjdG9yLk5BVl9MSU5LUyArIFwiLFwiICsgKHRoaXMuX2NvbmZpZy50YXJnZXQgKyBcIiBcIiArIFNlbGVjdG9yLkxJU1RfSVRFTVMgKyBcIixcIikgKyAodGhpcy5fY29uZmlnLnRhcmdldCArIFwiIFwiICsgU2VsZWN0b3IuRFJPUERPV05fSVRFTVMpO1xuICAgICAgdGhpcy5fb2Zmc2V0cyA9IFtdO1xuICAgICAgdGhpcy5fdGFyZ2V0cyA9IFtdO1xuICAgICAgdGhpcy5fYWN0aXZlVGFyZ2V0ID0gbnVsbDtcbiAgICAgIHRoaXMuX3Njcm9sbEhlaWdodCA9IDA7XG4gICAgICAkKHRoaXMuX3Njcm9sbEVsZW1lbnQpLm9uKEV2ZW50LlNDUk9MTCwgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIHJldHVybiBfdGhpcy5fcHJvY2VzcyhldmVudCk7XG4gICAgICB9KTtcbiAgICAgIHRoaXMucmVmcmVzaCgpO1xuXG4gICAgICB0aGlzLl9wcm9jZXNzKCk7XG4gICAgfSAvLyBHZXR0ZXJzXG5cblxuICAgIHZhciBfcHJvdG8gPSBTY3JvbGxTcHkucHJvdG90eXBlO1xuXG4gICAgLy8gUHVibGljXG4gICAgX3Byb3RvLnJlZnJlc2ggPSBmdW5jdGlvbiByZWZyZXNoKCkge1xuICAgICAgdmFyIF90aGlzMiA9IHRoaXM7XG5cbiAgICAgIHZhciBhdXRvTWV0aG9kID0gdGhpcy5fc2Nyb2xsRWxlbWVudCA9PT0gdGhpcy5fc2Nyb2xsRWxlbWVudC53aW5kb3cgPyBPZmZzZXRNZXRob2QuT0ZGU0VUIDogT2Zmc2V0TWV0aG9kLlBPU0lUSU9OO1xuICAgICAgdmFyIG9mZnNldE1ldGhvZCA9IHRoaXMuX2NvbmZpZy5tZXRob2QgPT09ICdhdXRvJyA/IGF1dG9NZXRob2QgOiB0aGlzLl9jb25maWcubWV0aG9kO1xuICAgICAgdmFyIG9mZnNldEJhc2UgPSBvZmZzZXRNZXRob2QgPT09IE9mZnNldE1ldGhvZC5QT1NJVElPTiA/IHRoaXMuX2dldFNjcm9sbFRvcCgpIDogMDtcbiAgICAgIHRoaXMuX29mZnNldHMgPSBbXTtcbiAgICAgIHRoaXMuX3RhcmdldHMgPSBbXTtcbiAgICAgIHRoaXMuX3Njcm9sbEhlaWdodCA9IHRoaXMuX2dldFNjcm9sbEhlaWdodCgpO1xuICAgICAgdmFyIHRhcmdldHMgPSAkLm1ha2VBcnJheSgkKHRoaXMuX3NlbGVjdG9yKSk7XG4gICAgICB0YXJnZXRzLm1hcChmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICB2YXIgdGFyZ2V0O1xuICAgICAgICB2YXIgdGFyZ2V0U2VsZWN0b3IgPSBVdGlsLmdldFNlbGVjdG9yRnJvbUVsZW1lbnQoZWxlbWVudCk7XG5cbiAgICAgICAgaWYgKHRhcmdldFNlbGVjdG9yKSB7XG4gICAgICAgICAgdGFyZ2V0ID0gJCh0YXJnZXRTZWxlY3RvcilbMF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgdmFyIHRhcmdldEJDUiA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgICAgICAgIGlmICh0YXJnZXRCQ1Iud2lkdGggfHwgdGFyZ2V0QkNSLmhlaWdodCkge1xuICAgICAgICAgICAgLy8gVE9ETyAoZmF0KTogcmVtb3ZlIHNrZXRjaCByZWxpYW5jZSBvbiBqUXVlcnkgcG9zaXRpb24vb2Zmc2V0XG4gICAgICAgICAgICByZXR1cm4gWyQodGFyZ2V0KVtvZmZzZXRNZXRob2RdKCkudG9wICsgb2Zmc2V0QmFzZSwgdGFyZ2V0U2VsZWN0b3JdO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSkuZmlsdGVyKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgfSkuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYVswXSAtIGJbMF07XG4gICAgICB9KS5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgIF90aGlzMi5fb2Zmc2V0cy5wdXNoKGl0ZW1bMF0pO1xuXG4gICAgICAgIF90aGlzMi5fdGFyZ2V0cy5wdXNoKGl0ZW1bMV0pO1xuICAgICAgfSk7XG4gICAgfTtcblxuICAgIF9wcm90by5kaXNwb3NlID0gZnVuY3Rpb24gZGlzcG9zZSgpIHtcbiAgICAgICQucmVtb3ZlRGF0YSh0aGlzLl9lbGVtZW50LCBEQVRBX0tFWSk7XG4gICAgICAkKHRoaXMuX3Njcm9sbEVsZW1lbnQpLm9mZihFVkVOVF9LRVkpO1xuICAgICAgdGhpcy5fZWxlbWVudCA9IG51bGw7XG4gICAgICB0aGlzLl9zY3JvbGxFbGVtZW50ID0gbnVsbDtcbiAgICAgIHRoaXMuX2NvbmZpZyA9IG51bGw7XG4gICAgICB0aGlzLl9zZWxlY3RvciA9IG51bGw7XG4gICAgICB0aGlzLl9vZmZzZXRzID0gbnVsbDtcbiAgICAgIHRoaXMuX3RhcmdldHMgPSBudWxsO1xuICAgICAgdGhpcy5fYWN0aXZlVGFyZ2V0ID0gbnVsbDtcbiAgICAgIHRoaXMuX3Njcm9sbEhlaWdodCA9IG51bGw7XG4gICAgfTsgLy8gUHJpdmF0ZVxuXG5cbiAgICBfcHJvdG8uX2dldENvbmZpZyA9IGZ1bmN0aW9uIF9nZXRDb25maWcoY29uZmlnKSB7XG4gICAgICBjb25maWcgPSBfZXh0ZW5kcyh7fSwgRGVmYXVsdCwgY29uZmlnKTtcblxuICAgICAgaWYgKHR5cGVvZiBjb25maWcudGFyZ2V0ICE9PSAnc3RyaW5nJykge1xuICAgICAgICB2YXIgaWQgPSAkKGNvbmZpZy50YXJnZXQpLmF0dHIoJ2lkJyk7XG5cbiAgICAgICAgaWYgKCFpZCkge1xuICAgICAgICAgIGlkID0gVXRpbC5nZXRVSUQoTkFNRSk7XG4gICAgICAgICAgJChjb25maWcudGFyZ2V0KS5hdHRyKCdpZCcsIGlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbmZpZy50YXJnZXQgPSBcIiNcIiArIGlkO1xuICAgICAgfVxuXG4gICAgICBVdGlsLnR5cGVDaGVja0NvbmZpZyhOQU1FLCBjb25maWcsIERlZmF1bHRUeXBlKTtcbiAgICAgIHJldHVybiBjb25maWc7XG4gICAgfTtcblxuICAgIF9wcm90by5fZ2V0U2Nyb2xsVG9wID0gZnVuY3Rpb24gX2dldFNjcm9sbFRvcCgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zY3JvbGxFbGVtZW50ID09PSB3aW5kb3cgPyB0aGlzLl9zY3JvbGxFbGVtZW50LnBhZ2VZT2Zmc2V0IDogdGhpcy5fc2Nyb2xsRWxlbWVudC5zY3JvbGxUb3A7XG4gICAgfTtcblxuICAgIF9wcm90by5fZ2V0U2Nyb2xsSGVpZ2h0ID0gZnVuY3Rpb24gX2dldFNjcm9sbEhlaWdodCgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zY3JvbGxFbGVtZW50LnNjcm9sbEhlaWdodCB8fCBNYXRoLm1heChkb2N1bWVudC5ib2R5LnNjcm9sbEhlaWdodCwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbEhlaWdodCk7XG4gICAgfTtcblxuICAgIF9wcm90by5fZ2V0T2Zmc2V0SGVpZ2h0ID0gZnVuY3Rpb24gX2dldE9mZnNldEhlaWdodCgpIHtcbiAgICAgIHJldHVybiB0aGlzLl9zY3JvbGxFbGVtZW50ID09PSB3aW5kb3cgPyB3aW5kb3cuaW5uZXJIZWlnaHQgOiB0aGlzLl9zY3JvbGxFbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodDtcbiAgICB9O1xuXG4gICAgX3Byb3RvLl9wcm9jZXNzID0gZnVuY3Rpb24gX3Byb2Nlc3MoKSB7XG4gICAgICB2YXIgc2Nyb2xsVG9wID0gdGhpcy5fZ2V0U2Nyb2xsVG9wKCkgKyB0aGlzLl9jb25maWcub2Zmc2V0O1xuXG4gICAgICB2YXIgc2Nyb2xsSGVpZ2h0ID0gdGhpcy5fZ2V0U2Nyb2xsSGVpZ2h0KCk7XG5cbiAgICAgIHZhciBtYXhTY3JvbGwgPSB0aGlzLl9jb25maWcub2Zmc2V0ICsgc2Nyb2xsSGVpZ2h0IC0gdGhpcy5fZ2V0T2Zmc2V0SGVpZ2h0KCk7XG5cbiAgICAgIGlmICh0aGlzLl9zY3JvbGxIZWlnaHQgIT09IHNjcm9sbEhlaWdodCkge1xuICAgICAgICB0aGlzLnJlZnJlc2goKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNjcm9sbFRvcCA+PSBtYXhTY3JvbGwpIHtcbiAgICAgICAgdmFyIHRhcmdldCA9IHRoaXMuX3RhcmdldHNbdGhpcy5fdGFyZ2V0cy5sZW5ndGggLSAxXTtcblxuICAgICAgICBpZiAodGhpcy5fYWN0aXZlVGFyZ2V0ICE9PSB0YXJnZXQpIHtcbiAgICAgICAgICB0aGlzLl9hY3RpdmF0ZSh0YXJnZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fYWN0aXZlVGFyZ2V0ICYmIHNjcm9sbFRvcCA8IHRoaXMuX29mZnNldHNbMF0gJiYgdGhpcy5fb2Zmc2V0c1swXSA+IDApIHtcbiAgICAgICAgdGhpcy5fYWN0aXZlVGFyZ2V0ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9jbGVhcigpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZm9yICh2YXIgaSA9IHRoaXMuX29mZnNldHMubGVuZ3RoOyBpLS07KSB7XG4gICAgICAgIHZhciBpc0FjdGl2ZVRhcmdldCA9IHRoaXMuX2FjdGl2ZVRhcmdldCAhPT0gdGhpcy5fdGFyZ2V0c1tpXSAmJiBzY3JvbGxUb3AgPj0gdGhpcy5fb2Zmc2V0c1tpXSAmJiAodHlwZW9mIHRoaXMuX29mZnNldHNbaSArIDFdID09PSAndW5kZWZpbmVkJyB8fCBzY3JvbGxUb3AgPCB0aGlzLl9vZmZzZXRzW2kgKyAxXSk7XG5cbiAgICAgICAgaWYgKGlzQWN0aXZlVGFyZ2V0KSB7XG4gICAgICAgICAgdGhpcy5fYWN0aXZhdGUodGhpcy5fdGFyZ2V0c1tpXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgX3Byb3RvLl9hY3RpdmF0ZSA9IGZ1bmN0aW9uIF9hY3RpdmF0ZSh0YXJnZXQpIHtcbiAgICAgIHRoaXMuX2FjdGl2ZVRhcmdldCA9IHRhcmdldDtcblxuICAgICAgdGhpcy5fY2xlYXIoKTtcblxuICAgICAgdmFyIHF1ZXJpZXMgPSB0aGlzLl9zZWxlY3Rvci5zcGxpdCgnLCcpOyAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgYXJyb3ctYm9keS1zdHlsZVxuXG5cbiAgICAgIHF1ZXJpZXMgPSBxdWVyaWVzLm1hcChmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yICsgXCJbZGF0YS10YXJnZXQ9XFxcIlwiICsgdGFyZ2V0ICsgXCJcXFwiXSxcIiArIChzZWxlY3RvciArIFwiW2hyZWY9XFxcIlwiICsgdGFyZ2V0ICsgXCJcXFwiXVwiKTtcbiAgICAgIH0pO1xuICAgICAgdmFyICRsaW5rID0gJChxdWVyaWVzLmpvaW4oJywnKSk7XG5cbiAgICAgIGlmICgkbGluay5oYXNDbGFzcyhDbGFzc05hbWUuRFJPUERPV05fSVRFTSkpIHtcbiAgICAgICAgJGxpbmsuY2xvc2VzdChTZWxlY3Rvci5EUk9QRE9XTikuZmluZChTZWxlY3Rvci5EUk9QRE9XTl9UT0dHTEUpLmFkZENsYXNzKENsYXNzTmFtZS5BQ1RJVkUpO1xuICAgICAgICAkbGluay5hZGRDbGFzcyhDbGFzc05hbWUuQUNUSVZFKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFNldCB0cmlnZ2VyZWQgbGluayBhcyBhY3RpdmVcbiAgICAgICAgJGxpbmsuYWRkQ2xhc3MoQ2xhc3NOYW1lLkFDVElWRSk7IC8vIFNldCB0cmlnZ2VyZWQgbGlua3MgcGFyZW50cyBhcyBhY3RpdmVcbiAgICAgICAgLy8gV2l0aCBib3RoIDx1bD4gYW5kIDxuYXY+IG1hcmt1cCBhIHBhcmVudCBpcyB0aGUgcHJldmlvdXMgc2libGluZyBvZiBhbnkgbmF2IGFuY2VzdG9yXG5cbiAgICAgICAgJGxpbmsucGFyZW50cyhTZWxlY3Rvci5OQVZfTElTVF9HUk9VUCkucHJldihTZWxlY3Rvci5OQVZfTElOS1MgKyBcIiwgXCIgKyBTZWxlY3Rvci5MSVNUX0lURU1TKS5hZGRDbGFzcyhDbGFzc05hbWUuQUNUSVZFKTsgLy8gSGFuZGxlIHNwZWNpYWwgY2FzZSB3aGVuIC5uYXYtbGluayBpcyBpbnNpZGUgLm5hdi1pdGVtXG5cbiAgICAgICAgJGxpbmsucGFyZW50cyhTZWxlY3Rvci5OQVZfTElTVF9HUk9VUCkucHJldihTZWxlY3Rvci5OQVZfSVRFTVMpLmNoaWxkcmVuKFNlbGVjdG9yLk5BVl9MSU5LUykuYWRkQ2xhc3MoQ2xhc3NOYW1lLkFDVElWRSk7XG4gICAgICB9XG5cbiAgICAgICQodGhpcy5fc2Nyb2xsRWxlbWVudCkudHJpZ2dlcihFdmVudC5BQ1RJVkFURSwge1xuICAgICAgICByZWxhdGVkVGFyZ2V0OiB0YXJnZXRcbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBfcHJvdG8uX2NsZWFyID0gZnVuY3Rpb24gX2NsZWFyKCkge1xuICAgICAgJCh0aGlzLl9zZWxlY3RvcikuZmlsdGVyKFNlbGVjdG9yLkFDVElWRSkucmVtb3ZlQ2xhc3MoQ2xhc3NOYW1lLkFDVElWRSk7XG4gICAgfTsgLy8gU3RhdGljXG5cblxuICAgIFNjcm9sbFNweS5falF1ZXJ5SW50ZXJmYWNlID0gZnVuY3Rpb24gX2pRdWVyeUludGVyZmFjZShjb25maWcpIHtcbiAgICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZGF0YSA9ICQodGhpcykuZGF0YShEQVRBX0tFWSk7XG5cbiAgICAgICAgdmFyIF9jb25maWcgPSB0eXBlb2YgY29uZmlnID09PSAnb2JqZWN0JyAmJiBjb25maWc7XG5cbiAgICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgICAgZGF0YSA9IG5ldyBTY3JvbGxTcHkodGhpcywgX2NvbmZpZyk7XG4gICAgICAgICAgJCh0aGlzKS5kYXRhKERBVEFfS0VZLCBkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGlmICh0eXBlb2YgZGF0YVtjb25maWddID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk5vIG1ldGhvZCBuYW1lZCBcXFwiXCIgKyBjb25maWcgKyBcIlxcXCJcIik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZGF0YVtjb25maWddKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBfY3JlYXRlQ2xhc3MoU2Nyb2xsU3B5LCBudWxsLCBbe1xuICAgICAga2V5OiBcIlZFUlNJT05cIixcbiAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICByZXR1cm4gVkVSU0lPTjtcbiAgICAgIH1cbiAgICB9LCB7XG4gICAgICBrZXk6IFwiRGVmYXVsdFwiLFxuICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBEZWZhdWx0O1xuICAgICAgfVxuICAgIH1dKTtcblxuICAgIHJldHVybiBTY3JvbGxTcHk7XG4gIH0oKTtcbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBEYXRhIEFwaSBpbXBsZW1lbnRhdGlvblxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICovXG5cblxuICAkKHdpbmRvdykub24oRXZlbnQuTE9BRF9EQVRBX0FQSSwgZnVuY3Rpb24gKCkge1xuICAgIHZhciBzY3JvbGxTcHlzID0gJC5tYWtlQXJyYXkoJChTZWxlY3Rvci5EQVRBX1NQWSkpO1xuXG4gICAgZm9yICh2YXIgaSA9IHNjcm9sbFNweXMubGVuZ3RoOyBpLS07KSB7XG4gICAgICB2YXIgJHNweSA9ICQoc2Nyb2xsU3B5c1tpXSk7XG5cbiAgICAgIFNjcm9sbFNweS5falF1ZXJ5SW50ZXJmYWNlLmNhbGwoJHNweSwgJHNweS5kYXRhKCkpO1xuICAgIH1cbiAgfSk7XG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogalF1ZXJ5XG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cblxuICAkLmZuW05BTUVdID0gU2Nyb2xsU3B5Ll9qUXVlcnlJbnRlcmZhY2U7XG4gICQuZm5bTkFNRV0uQ29uc3RydWN0b3IgPSBTY3JvbGxTcHk7XG5cbiAgJC5mbltOQU1FXS5ub0NvbmZsaWN0ID0gZnVuY3Rpb24gKCkge1xuICAgICQuZm5bTkFNRV0gPSBKUVVFUllfTk9fQ09ORkxJQ1Q7XG4gICAgcmV0dXJuIFNjcm9sbFNweS5falF1ZXJ5SW50ZXJmYWNlO1xuICB9O1xuXG4gIHJldHVybiBTY3JvbGxTcHk7XG59KCQpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c2Nyb2xsc3B5LmpzLm1hcCIsImZ1bmN0aW9uIF9kZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKFwidmFsdWVcIiBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH1cblxuZnVuY3Rpb24gX2NyZWF0ZUNsYXNzKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgX2RlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBfZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH1cblxuLyoqXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQm9vdHN0cmFwICh2NC4wLjApOiB0YWIuanNcbiAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFzdGVyL0xJQ0VOU0UpXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICovXG52YXIgVGFiID0gZnVuY3Rpb24gKCQpIHtcbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBDb25zdGFudHNcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuICB2YXIgTkFNRSA9ICd0YWInO1xuICB2YXIgVkVSU0lPTiA9ICc0LjAuMCc7XG4gIHZhciBEQVRBX0tFWSA9ICdicy50YWInO1xuICB2YXIgRVZFTlRfS0VZID0gXCIuXCIgKyBEQVRBX0tFWTtcbiAgdmFyIERBVEFfQVBJX0tFWSA9ICcuZGF0YS1hcGknO1xuICB2YXIgSlFVRVJZX05PX0NPTkZMSUNUID0gJC5mbltOQU1FXTtcbiAgdmFyIFRSQU5TSVRJT05fRFVSQVRJT04gPSAxNTA7XG4gIHZhciBFdmVudCA9IHtcbiAgICBISURFOiBcImhpZGVcIiArIEVWRU5UX0tFWSxcbiAgICBISURERU46IFwiaGlkZGVuXCIgKyBFVkVOVF9LRVksXG4gICAgU0hPVzogXCJzaG93XCIgKyBFVkVOVF9LRVksXG4gICAgU0hPV046IFwic2hvd25cIiArIEVWRU5UX0tFWSxcbiAgICBDTElDS19EQVRBX0FQSTogXCJjbGlja1wiICsgRVZFTlRfS0VZICsgREFUQV9BUElfS0VZXG4gIH07XG4gIHZhciBDbGFzc05hbWUgPSB7XG4gICAgRFJPUERPV05fTUVOVTogJ2Ryb3Bkb3duLW1lbnUnLFxuICAgIEFDVElWRTogJ2FjdGl2ZScsXG4gICAgRElTQUJMRUQ6ICdkaXNhYmxlZCcsXG4gICAgRkFERTogJ2ZhZGUnLFxuICAgIFNIT1c6ICdzaG93J1xuICB9O1xuICB2YXIgU2VsZWN0b3IgPSB7XG4gICAgRFJPUERPV046ICcuZHJvcGRvd24nLFxuICAgIE5BVl9MSVNUX0dST1VQOiAnLm5hdiwgLmxpc3QtZ3JvdXAnLFxuICAgIEFDVElWRTogJy5hY3RpdmUnLFxuICAgIEFDVElWRV9VTDogJz4gbGkgPiAuYWN0aXZlJyxcbiAgICBEQVRBX1RPR0dMRTogJ1tkYXRhLXRvZ2dsZT1cInRhYlwiXSwgW2RhdGEtdG9nZ2xlPVwicGlsbFwiXSwgW2RhdGEtdG9nZ2xlPVwibGlzdFwiXScsXG4gICAgRFJPUERPV05fVE9HR0xFOiAnLmRyb3Bkb3duLXRvZ2dsZScsXG4gICAgRFJPUERPV05fQUNUSVZFX0NISUxEOiAnPiAuZHJvcGRvd24tbWVudSAuYWN0aXZlJ1xuICAgIC8qKlxuICAgICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAqIENsYXNzIERlZmluaXRpb25cbiAgICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgKi9cblxuICB9O1xuXG4gIHZhciBUYWIgPVxuICAvKiNfX1BVUkVfXyovXG4gIGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBUYWIoZWxlbWVudCkge1xuICAgICAgdGhpcy5fZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgfSAvLyBHZXR0ZXJzXG5cblxuICAgIHZhciBfcHJvdG8gPSBUYWIucHJvdG90eXBlO1xuXG4gICAgLy8gUHVibGljXG4gICAgX3Byb3RvLnNob3cgPSBmdW5jdGlvbiBzaG93KCkge1xuICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgaWYgKHRoaXMuX2VsZW1lbnQucGFyZW50Tm9kZSAmJiB0aGlzLl9lbGVtZW50LnBhcmVudE5vZGUubm9kZVR5cGUgPT09IE5vZGUuRUxFTUVOVF9OT0RFICYmICQodGhpcy5fZWxlbWVudCkuaGFzQ2xhc3MoQ2xhc3NOYW1lLkFDVElWRSkgfHwgJCh0aGlzLl9lbGVtZW50KS5oYXNDbGFzcyhDbGFzc05hbWUuRElTQUJMRUQpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIHRhcmdldDtcbiAgICAgIHZhciBwcmV2aW91cztcbiAgICAgIHZhciBsaXN0RWxlbWVudCA9ICQodGhpcy5fZWxlbWVudCkuY2xvc2VzdChTZWxlY3Rvci5OQVZfTElTVF9HUk9VUClbMF07XG4gICAgICB2YXIgc2VsZWN0b3IgPSBVdGlsLmdldFNlbGVjdG9yRnJvbUVsZW1lbnQodGhpcy5fZWxlbWVudCk7XG5cbiAgICAgIGlmIChsaXN0RWxlbWVudCkge1xuICAgICAgICB2YXIgaXRlbVNlbGVjdG9yID0gbGlzdEVsZW1lbnQubm9kZU5hbWUgPT09ICdVTCcgPyBTZWxlY3Rvci5BQ1RJVkVfVUwgOiBTZWxlY3Rvci5BQ1RJVkU7XG4gICAgICAgIHByZXZpb3VzID0gJC5tYWtlQXJyYXkoJChsaXN0RWxlbWVudCkuZmluZChpdGVtU2VsZWN0b3IpKTtcbiAgICAgICAgcHJldmlvdXMgPSBwcmV2aW91c1twcmV2aW91cy5sZW5ndGggLSAxXTtcbiAgICAgIH1cblxuICAgICAgdmFyIGhpZGVFdmVudCA9ICQuRXZlbnQoRXZlbnQuSElERSwge1xuICAgICAgICByZWxhdGVkVGFyZ2V0OiB0aGlzLl9lbGVtZW50XG4gICAgICB9KTtcbiAgICAgIHZhciBzaG93RXZlbnQgPSAkLkV2ZW50KEV2ZW50LlNIT1csIHtcbiAgICAgICAgcmVsYXRlZFRhcmdldDogcHJldmlvdXNcbiAgICAgIH0pO1xuXG4gICAgICBpZiAocHJldmlvdXMpIHtcbiAgICAgICAgJChwcmV2aW91cykudHJpZ2dlcihoaWRlRXZlbnQpO1xuICAgICAgfVxuXG4gICAgICAkKHRoaXMuX2VsZW1lbnQpLnRyaWdnZXIoc2hvd0V2ZW50KTtcblxuICAgICAgaWYgKHNob3dFdmVudC5pc0RlZmF1bHRQcmV2ZW50ZWQoKSB8fCBoaWRlRXZlbnQuaXNEZWZhdWx0UHJldmVudGVkKCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZWN0b3IpIHtcbiAgICAgICAgdGFyZ2V0ID0gJChzZWxlY3RvcilbMF07XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX2FjdGl2YXRlKHRoaXMuX2VsZW1lbnQsIGxpc3RFbGVtZW50KTtcblxuICAgICAgdmFyIGNvbXBsZXRlID0gZnVuY3Rpb24gY29tcGxldGUoKSB7XG4gICAgICAgIHZhciBoaWRkZW5FdmVudCA9ICQuRXZlbnQoRXZlbnQuSElEREVOLCB7XG4gICAgICAgICAgcmVsYXRlZFRhcmdldDogX3RoaXMuX2VsZW1lbnRcbiAgICAgICAgfSk7XG4gICAgICAgIHZhciBzaG93bkV2ZW50ID0gJC5FdmVudChFdmVudC5TSE9XTiwge1xuICAgICAgICAgIHJlbGF0ZWRUYXJnZXQ6IHByZXZpb3VzXG4gICAgICAgIH0pO1xuICAgICAgICAkKHByZXZpb3VzKS50cmlnZ2VyKGhpZGRlbkV2ZW50KTtcbiAgICAgICAgJChfdGhpcy5fZWxlbWVudCkudHJpZ2dlcihzaG93bkV2ZW50KTtcbiAgICAgIH07XG5cbiAgICAgIGlmICh0YXJnZXQpIHtcbiAgICAgICAgdGhpcy5fYWN0aXZhdGUodGFyZ2V0LCB0YXJnZXQucGFyZW50Tm9kZSwgY29tcGxldGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tcGxldGUoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgX3Byb3RvLmRpc3Bvc2UgPSBmdW5jdGlvbiBkaXNwb3NlKCkge1xuICAgICAgJC5yZW1vdmVEYXRhKHRoaXMuX2VsZW1lbnQsIERBVEFfS0VZKTtcbiAgICAgIHRoaXMuX2VsZW1lbnQgPSBudWxsO1xuICAgIH07IC8vIFByaXZhdGVcblxuXG4gICAgX3Byb3RvLl9hY3RpdmF0ZSA9IGZ1bmN0aW9uIF9hY3RpdmF0ZShlbGVtZW50LCBjb250YWluZXIsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgdmFyIGFjdGl2ZUVsZW1lbnRzO1xuXG4gICAgICBpZiAoY29udGFpbmVyLm5vZGVOYW1lID09PSAnVUwnKSB7XG4gICAgICAgIGFjdGl2ZUVsZW1lbnRzID0gJChjb250YWluZXIpLmZpbmQoU2VsZWN0b3IuQUNUSVZFX1VMKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFjdGl2ZUVsZW1lbnRzID0gJChjb250YWluZXIpLmNoaWxkcmVuKFNlbGVjdG9yLkFDVElWRSk7XG4gICAgICB9XG5cbiAgICAgIHZhciBhY3RpdmUgPSBhY3RpdmVFbGVtZW50c1swXTtcbiAgICAgIHZhciBpc1RyYW5zaXRpb25pbmcgPSBjYWxsYmFjayAmJiBVdGlsLnN1cHBvcnRzVHJhbnNpdGlvbkVuZCgpICYmIGFjdGl2ZSAmJiAkKGFjdGl2ZSkuaGFzQ2xhc3MoQ2xhc3NOYW1lLkZBREUpO1xuXG4gICAgICB2YXIgY29tcGxldGUgPSBmdW5jdGlvbiBjb21wbGV0ZSgpIHtcbiAgICAgICAgcmV0dXJuIF90aGlzMi5fdHJhbnNpdGlvbkNvbXBsZXRlKGVsZW1lbnQsIGFjdGl2ZSwgY2FsbGJhY2spO1xuICAgICAgfTtcblxuICAgICAgaWYgKGFjdGl2ZSAmJiBpc1RyYW5zaXRpb25pbmcpIHtcbiAgICAgICAgJChhY3RpdmUpLm9uZShVdGlsLlRSQU5TSVRJT05fRU5ELCBjb21wbGV0ZSkuZW11bGF0ZVRyYW5zaXRpb25FbmQoVFJBTlNJVElPTl9EVVJBVElPTik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb21wbGV0ZSgpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBfcHJvdG8uX3RyYW5zaXRpb25Db21wbGV0ZSA9IGZ1bmN0aW9uIF90cmFuc2l0aW9uQ29tcGxldGUoZWxlbWVudCwgYWN0aXZlLCBjYWxsYmFjaykge1xuICAgICAgaWYgKGFjdGl2ZSkge1xuICAgICAgICAkKGFjdGl2ZSkucmVtb3ZlQ2xhc3MoQ2xhc3NOYW1lLlNIT1cgKyBcIiBcIiArIENsYXNzTmFtZS5BQ1RJVkUpO1xuICAgICAgICB2YXIgZHJvcGRvd25DaGlsZCA9ICQoYWN0aXZlLnBhcmVudE5vZGUpLmZpbmQoU2VsZWN0b3IuRFJPUERPV05fQUNUSVZFX0NISUxEKVswXTtcblxuICAgICAgICBpZiAoZHJvcGRvd25DaGlsZCkge1xuICAgICAgICAgICQoZHJvcGRvd25DaGlsZCkucmVtb3ZlQ2xhc3MoQ2xhc3NOYW1lLkFDVElWRSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWN0aXZlLmdldEF0dHJpYnV0ZSgncm9sZScpID09PSAndGFiJykge1xuICAgICAgICAgIGFjdGl2ZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgJChlbGVtZW50KS5hZGRDbGFzcyhDbGFzc05hbWUuQUNUSVZFKTtcblxuICAgICAgaWYgKGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdyb2xlJykgPT09ICd0YWInKSB7XG4gICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJywgdHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIFV0aWwucmVmbG93KGVsZW1lbnQpO1xuICAgICAgJChlbGVtZW50KS5hZGRDbGFzcyhDbGFzc05hbWUuU0hPVyk7XG5cbiAgICAgIGlmIChlbGVtZW50LnBhcmVudE5vZGUgJiYgJChlbGVtZW50LnBhcmVudE5vZGUpLmhhc0NsYXNzKENsYXNzTmFtZS5EUk9QRE9XTl9NRU5VKSkge1xuICAgICAgICB2YXIgZHJvcGRvd25FbGVtZW50ID0gJChlbGVtZW50KS5jbG9zZXN0KFNlbGVjdG9yLkRST1BET1dOKVswXTtcblxuICAgICAgICBpZiAoZHJvcGRvd25FbGVtZW50KSB7XG4gICAgICAgICAgJChkcm9wZG93bkVsZW1lbnQpLmZpbmQoU2VsZWN0b3IuRFJPUERPV05fVE9HR0xFKS5hZGRDbGFzcyhDbGFzc05hbWUuQUNUSVZFKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgdHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfVxuICAgIH07IC8vIFN0YXRpY1xuXG5cbiAgICBUYWIuX2pRdWVyeUludGVyZmFjZSA9IGZ1bmN0aW9uIF9qUXVlcnlJbnRlcmZhY2UoY29uZmlnKSB7XG4gICAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyICR0aGlzID0gJCh0aGlzKTtcbiAgICAgICAgdmFyIGRhdGEgPSAkdGhpcy5kYXRhKERBVEFfS0VZKTtcblxuICAgICAgICBpZiAoIWRhdGEpIHtcbiAgICAgICAgICBkYXRhID0gbmV3IFRhYih0aGlzKTtcbiAgICAgICAgICAkdGhpcy5kYXRhKERBVEFfS0VZLCBkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGlmICh0eXBlb2YgZGF0YVtjb25maWddID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIk5vIG1ldGhvZCBuYW1lZCBcXFwiXCIgKyBjb25maWcgKyBcIlxcXCJcIik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZGF0YVtjb25maWddKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH07XG5cbiAgICBfY3JlYXRlQ2xhc3MoVGFiLCBudWxsLCBbe1xuICAgICAga2V5OiBcIlZFUlNJT05cIixcbiAgICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICByZXR1cm4gVkVSU0lPTjtcbiAgICAgIH1cbiAgICB9XSk7XG5cbiAgICByZXR1cm4gVGFiO1xuICB9KCk7XG4gIC8qKlxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogRGF0YSBBcGkgaW1wbGVtZW50YXRpb25cbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgJChkb2N1bWVudCkub24oRXZlbnQuQ0xJQ0tfREFUQV9BUEksIFNlbGVjdG9yLkRBVEFfVE9HR0xFLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgVGFiLl9qUXVlcnlJbnRlcmZhY2UuY2FsbCgkKHRoaXMpLCAnc2hvdycpO1xuICB9KTtcbiAgLyoqXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBqUXVlcnlcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG4gICQuZm5bTkFNRV0gPSBUYWIuX2pRdWVyeUludGVyZmFjZTtcbiAgJC5mbltOQU1FXS5Db25zdHJ1Y3RvciA9IFRhYjtcblxuICAkLmZuW05BTUVdLm5vQ29uZmxpY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgJC5mbltOQU1FXSA9IEpRVUVSWV9OT19DT05GTElDVDtcbiAgICByZXR1cm4gVGFiLl9qUXVlcnlJbnRlcmZhY2U7XG4gIH07XG5cbiAgcmV0dXJuIFRhYjtcbn0oJCk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10YWIuanMubWFwIiwiLyoqXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQm9vdHN0cmFwICh2NC4wLjApOiB1dGlsLmpzXG4gKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21hc3Rlci9MSUNFTlNFKVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqL1xudmFyIFV0aWwgPSBmdW5jdGlvbiAoJCkge1xuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIFByaXZhdGUgVHJhbnNpdGlvbkVuZCBIZWxwZXJzXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKi9cbiAgdmFyIHRyYW5zaXRpb24gPSBmYWxzZTtcbiAgdmFyIE1BWF9VSUQgPSAxMDAwMDAwOyAvLyBTaG91dG91dCBBbmd1c0Nyb2xsIChodHRwczovL2dvby5nbC9weHdRR3ApXG5cbiAgZnVuY3Rpb24gdG9UeXBlKG9iaikge1xuICAgIHJldHVybiB7fS50b1N0cmluZy5jYWxsKG9iaikubWF0Y2goL1xccyhbYS16QS1aXSspLylbMV0udG9Mb3dlckNhc2UoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFNwZWNpYWxUcmFuc2l0aW9uRW5kRXZlbnQoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGJpbmRUeXBlOiB0cmFuc2l0aW9uLmVuZCxcbiAgICAgIGRlbGVnYXRlVHlwZTogdHJhbnNpdGlvbi5lbmQsXG4gICAgICBoYW5kbGU6IGZ1bmN0aW9uIGhhbmRsZShldmVudCkge1xuICAgICAgICBpZiAoJChldmVudC50YXJnZXQpLmlzKHRoaXMpKSB7XG4gICAgICAgICAgcmV0dXJuIGV2ZW50LmhhbmRsZU9iai5oYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgcHJlZmVyLXJlc3QtcGFyYW1zXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVuZGVmaW5lZFxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiB0cmFuc2l0aW9uRW5kVGVzdCgpIHtcbiAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LlFVbml0KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGVuZDogJ3RyYW5zaXRpb25lbmQnXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyYW5zaXRpb25FbmRFbXVsYXRvcihkdXJhdGlvbikge1xuICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICB2YXIgY2FsbGVkID0gZmFsc2U7XG4gICAgJCh0aGlzKS5vbmUoVXRpbC5UUkFOU0lUSU9OX0VORCwgZnVuY3Rpb24gKCkge1xuICAgICAgY2FsbGVkID0gdHJ1ZTtcbiAgICB9KTtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghY2FsbGVkKSB7XG4gICAgICAgIFV0aWwudHJpZ2dlclRyYW5zaXRpb25FbmQoX3RoaXMpO1xuICAgICAgfVxuICAgIH0sIGR1cmF0aW9uKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFRyYW5zaXRpb25FbmRTdXBwb3J0KCkge1xuICAgIHRyYW5zaXRpb24gPSB0cmFuc2l0aW9uRW5kVGVzdCgpO1xuICAgICQuZm4uZW11bGF0ZVRyYW5zaXRpb25FbmQgPSB0cmFuc2l0aW9uRW5kRW11bGF0b3I7XG5cbiAgICBpZiAoVXRpbC5zdXBwb3J0c1RyYW5zaXRpb25FbmQoKSkge1xuICAgICAgJC5ldmVudC5zcGVjaWFsW1V0aWwuVFJBTlNJVElPTl9FTkRdID0gZ2V0U3BlY2lhbFRyYW5zaXRpb25FbmRFdmVudCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGVzY2FwZUlkKHNlbGVjdG9yKSB7XG4gICAgLy8gV2UgZXNjYXBlIElEcyBpbiBjYXNlIG9mIHNwZWNpYWwgc2VsZWN0b3JzIChzZWxlY3RvciA9ICcjbXlJZDpzb21ldGhpbmcnKVxuICAgIC8vICQuZXNjYXBlU2VsZWN0b3IgZG9lcyBub3QgZXhpc3QgaW4galF1ZXJ5IDwgM1xuICAgIHNlbGVjdG9yID0gdHlwZW9mICQuZXNjYXBlU2VsZWN0b3IgPT09ICdmdW5jdGlvbicgPyAkLmVzY2FwZVNlbGVjdG9yKHNlbGVjdG9yKS5zdWJzdHIoMSkgOiBzZWxlY3Rvci5yZXBsYWNlKC8oOnxcXC58XFxbfFxcXXwsfD18QCkvZywgJ1xcXFwkMScpO1xuICAgIHJldHVybiBzZWxlY3RvcjtcbiAgfVxuICAvKipcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogUHVibGljIFV0aWwgQXBpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqL1xuXG5cbiAgdmFyIFV0aWwgPSB7XG4gICAgVFJBTlNJVElPTl9FTkQ6ICdic1RyYW5zaXRpb25FbmQnLFxuICAgIGdldFVJRDogZnVuY3Rpb24gZ2V0VUlEKHByZWZpeCkge1xuICAgICAgZG8ge1xuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tYml0d2lzZVxuICAgICAgICBwcmVmaXggKz0gfn4oTWF0aC5yYW5kb20oKSAqIE1BWF9VSUQpOyAvLyBcIn5+XCIgYWN0cyBsaWtlIGEgZmFzdGVyIE1hdGguZmxvb3IoKSBoZXJlXG4gICAgICB9IHdoaWxlIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChwcmVmaXgpKTtcblxuICAgICAgcmV0dXJuIHByZWZpeDtcbiAgICB9LFxuICAgIGdldFNlbGVjdG9yRnJvbUVsZW1lbnQ6IGZ1bmN0aW9uIGdldFNlbGVjdG9yRnJvbUVsZW1lbnQoZWxlbWVudCkge1xuICAgICAgdmFyIHNlbGVjdG9yID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGFyZ2V0Jyk7XG5cbiAgICAgIGlmICghc2VsZWN0b3IgfHwgc2VsZWN0b3IgPT09ICcjJykge1xuICAgICAgICBzZWxlY3RvciA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdocmVmJykgfHwgJyc7XG4gICAgICB9IC8vIElmIGl0J3MgYW4gSURcblxuXG4gICAgICBpZiAoc2VsZWN0b3IuY2hhckF0KDApID09PSAnIycpIHtcbiAgICAgICAgc2VsZWN0b3IgPSBlc2NhcGVJZChzZWxlY3Rvcik7XG4gICAgICB9XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciAkc2VsZWN0b3IgPSAkKGRvY3VtZW50KS5maW5kKHNlbGVjdG9yKTtcbiAgICAgICAgcmV0dXJuICRzZWxlY3Rvci5sZW5ndGggPiAwID8gc2VsZWN0b3IgOiBudWxsO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0sXG4gICAgcmVmbG93OiBmdW5jdGlvbiByZWZsb3coZWxlbWVudCkge1xuICAgICAgcmV0dXJuIGVsZW1lbnQub2Zmc2V0SGVpZ2h0O1xuICAgIH0sXG4gICAgdHJpZ2dlclRyYW5zaXRpb25FbmQ6IGZ1bmN0aW9uIHRyaWdnZXJUcmFuc2l0aW9uRW5kKGVsZW1lbnQpIHtcbiAgICAgICQoZWxlbWVudCkudHJpZ2dlcih0cmFuc2l0aW9uLmVuZCk7XG4gICAgfSxcbiAgICBzdXBwb3J0c1RyYW5zaXRpb25FbmQ6IGZ1bmN0aW9uIHN1cHBvcnRzVHJhbnNpdGlvbkVuZCgpIHtcbiAgICAgIHJldHVybiBCb29sZWFuKHRyYW5zaXRpb24pO1xuICAgIH0sXG4gICAgaXNFbGVtZW50OiBmdW5jdGlvbiBpc0VsZW1lbnQob2JqKSB7XG4gICAgICByZXR1cm4gKG9ialswXSB8fCBvYmopLm5vZGVUeXBlO1xuICAgIH0sXG4gICAgdHlwZUNoZWNrQ29uZmlnOiBmdW5jdGlvbiB0eXBlQ2hlY2tDb25maWcoY29tcG9uZW50TmFtZSwgY29uZmlnLCBjb25maWdUeXBlcykge1xuICAgICAgZm9yICh2YXIgcHJvcGVydHkgaW4gY29uZmlnVHlwZXMpIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb25maWdUeXBlcywgcHJvcGVydHkpKSB7XG4gICAgICAgICAgdmFyIGV4cGVjdGVkVHlwZXMgPSBjb25maWdUeXBlc1twcm9wZXJ0eV07XG4gICAgICAgICAgdmFyIHZhbHVlID0gY29uZmlnW3Byb3BlcnR5XTtcbiAgICAgICAgICB2YXIgdmFsdWVUeXBlID0gdmFsdWUgJiYgVXRpbC5pc0VsZW1lbnQodmFsdWUpID8gJ2VsZW1lbnQnIDogdG9UeXBlKHZhbHVlKTtcblxuICAgICAgICAgIGlmICghbmV3IFJlZ0V4cChleHBlY3RlZFR5cGVzKS50ZXN0KHZhbHVlVHlwZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihjb21wb25lbnROYW1lLnRvVXBwZXJDYXNlKCkgKyBcIjogXCIgKyAoXCJPcHRpb24gXFxcIlwiICsgcHJvcGVydHkgKyBcIlxcXCIgcHJvdmlkZWQgdHlwZSBcXFwiXCIgKyB2YWx1ZVR5cGUgKyBcIlxcXCIgXCIpICsgKFwiYnV0IGV4cGVjdGVkIHR5cGUgXFxcIlwiICsgZXhwZWN0ZWRUeXBlcyArIFwiXFxcIi5cIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgc2V0VHJhbnNpdGlvbkVuZFN1cHBvcnQoKTtcbiAgcmV0dXJuIFV0aWw7XG59KCQpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dXRpbC5qcy5tYXAiLCIoZnVuY3Rpb24oJCl7XG5cbiAgICAkKGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpIHtcblxuICAgICAgICAvKiB+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+ICovXG4gICAgICAgIC8qIH5+fn5+fn5+fn4gUGx1Z2luIEluaXRzIH5+fn5+fn5+fn4gKi9cbiAgICAgICAgLyogfn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fiAqL1xuXG4gICAgICAgICAgICAvKiB+fn5+fn5+fn5+IE1hdGNoIGhlaWdodCB+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgICAgICQoJy5tYXRjaC1oZWlnaHQnKS5tYXRjaEhlaWdodCh7XG4gICAgICAgICAgICAgICAgYnlSb3c6IHRydWUsXG4gICAgICAgICAgICAgICAgcHJvcGVydHk6ICdtaW4taGVpZ2h0JyxcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IG51bGwsXG4gICAgICAgICAgICAgICAgcmVtb3ZlOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgLyogfn5+fn5+fn5+fiBNb2JpbGUgbmF2aWdhdGlvbiB+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgICAgICQoJy5tYWluLWhlYWRlcicpLmFkZENsYXNzKCdtbWVudS1maXhlZCcpO1xuXG4gICAgICAgICAgICBpZigkKCcjd3BhZG1pbmJhcicpLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICQoJyN3cGFkbWluYmFyJykuYWRkQ2xhc3MoJ21tZW51LWZpeGVkJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciAkbWVudSA9ICQoXCIjbW9iaWxlLW5hdmlnYXRpb25cIikubW1lbnUoe1xuICAgICAgICAgICAgICAgIFwiZXh0ZW5zaW9uc1wiOiBbXG4gICAgICAgICAgICAgICAgICAgIFwicGFnZWRpbS1ibGFja1wiLFxuICAgICAgICAgICAgICAgICAgICBcInRoZW1lLWRhcmtcIlxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgXCJzbGlkaW5nU3VibWVudXNcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgXCJvZmZDYW52YXNcIjoge1xuICAgICAgICAgICAgICAgICAgICBcInBvc2l0aW9uXCI6IFwicmlnaHRcIlxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXCJuYXZiYXJzXCI6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgXCJwb3NpdGlvblwiOiBcInRvcFwiXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lczoge1xuICAgICAgICAgICAgICAgICAgICBmaXhlZEVsZW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaXhlZDogXCJtbWVudS1maXhlZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbUluc2VydFNlbGVjdG9yOiAnLm1haW4tY29udGVudCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB2YXIgJGljb24gPSAkKFwiI21tZW51LXRyaWdlclwiKTtcbiAgICAgICAgICAgIHZhciBBUEkgPSAkbWVudS5kYXRhKCBcIm1tZW51XCIgKTtcblxuICAgICAgICAgICAgJGljb24ub24oIFwiY2xpY2tcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYoJGljb24uaGFzQ2xhc3MoJ2lzLWFjdGl2ZScpKSB7XG4gICAgICAgICAgICAgICAgICAgIEFQSS5jbG9zZSgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIEFQSS5vcGVuKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIEFQSS5iaW5kKCBcIm9wZW5lZFwiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAkaWNvbi5hZGRDbGFzcyggXCJpcy1hY3RpdmVcIiApO1xuICAgICAgICAgICAgICAgfSwgMTApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBBUEkuYmluZCggXCJjbG9zZWRcIiwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgJGljb24ucmVtb3ZlQ2xhc3MoIFwiaXMtYWN0aXZlXCIgKTtcbiAgICAgICAgICAgICAgIH0sIDEwKTtcbiAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIC8qIH5+fn5+fn5+fn4gTGF6eSBMb2FkaW5nIH5+fn5+fn5+fn4gKi9cblxuICAgICAgICAgICAgJCgnLmxhenknKS5MYXp5KHtcbiAgICAgICAgICAgICAgICBlZmZlY3Q6ICdmYWRlSW4nXG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAvKiB+fn5+fn5+fn5+IEZhbmN5Ym94IEluaXQgfn5+fn5+fn5+fiAqL1xuXG4gICAgICAgICAgICAkKFwiLmNvbnRlbnQgYVtocmVmKj0nLmpwZyddLCAuY29udGVudCBhW2hyZWYqPScuanBlZyddLCAuY29udGVudCBhW2hyZWYqPScucG5nJ11cIikuZmFuY3lib3goKTtcblxuICAgICAgICAgICAgJCgnW2RhdGEtZmFuY3lib3hdJykuZmFuY3lib3goe1xuICAgICAgICAgICAgICAgIHlvdXR1YmUgOiB7XG4gICAgICAgICAgICAgICAgICAgIGF1dG9wbGF5IDogMVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgLyogfn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fiAqL1xuICAgICAgICAvKiB+fn5+fn5+fn5+IEZ1bmN0aW9ucyB+fn5+fn5+fn5+ICovXG4gICAgICAgIC8qIH5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn4gKi9cblxuICAgICAgICAgICAgLyogfn5+fn5+fn5+fiBNb2RhbCBmaXggfn5+fn5+fn5+fiAqL1xuXG4gICAgICAgICAgICAkKCcubW9kYWwnKS5hcHBlbmRUbygkKCdib2R5JykpO1xuXG5cbiAgICAgICAgICAgIC8qIH5+fn5+fn5+fn4gU2V0IGFuaW1hdGlvbiBzY3JvbGwgd2hlbiBVUkwgaXMgd2l0aCAjYW5jaG9yIGFuZCBtYWtlIHNtb290aCBzY3JvbGwgfn5+fn5+fn5+fiAqL1xuXG4gICAgICAgICAgICAkKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgaWYgKCB3aW5kb3cubG9jYXRpb24uaGFzaCApIHNjcm9sbCgwLDApO1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoIGZ1bmN0aW9uKCkgeyBzY3JvbGwoMCwwKTsgfSwgMSk7XG5cbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVySGVpZ2h0ID0gJCgnLm1haW4taGVhZGVyJykuaGVpZ2h0KCk7XG5cbiAgICAgICAgICAgICAgICBpZigkKCcjd3BhZG1pbmJhcicpLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICBoZWFkZXJIZWlnaHQgKz0gJCgnI3dwYWRtaW5iYXInKS5oZWlnaHQoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAkKCdhW2hyZWYqPVwiI1wiXTpub3QoLm1tLW5leHQpJykub24oJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgJCgnaHRtbCwgYm9keScpLmFuaW1hdGUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc2Nyb2xsVG9wOiAoJCgkKHRoaXMpLmF0dHIoJ2hyZWYnKSkub2Zmc2V0KCkudG9wIC0gaGVhZGVySGVpZ2h0KSArICdweCdcbiAgICAgICAgICAgICAgICAgICAgfSwgMTAwMCwgJ3N3aW5nJyk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBpZih3aW5kb3cubG9jYXRpb24uaGFzaCkge1xuICAgICAgICAgICAgICAgICAgICAkKCdodG1sLCBib2R5JykuYW5pbWF0ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY3JvbGxUb3A6ICgkKHdpbmRvdy5sb2NhdGlvbi5oYXNoKS5vZmZzZXQoKS50b3AgLSBoZWFkZXJIZWlnaHQpICsgJ3B4J1xuICAgICAgICAgICAgICAgICAgICB9LCAxMDAwLCAnc3dpbmcnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAvKiB+fn5+fn5+fn5+IFJldHVybiB0byB0b3AgYnV0dG9uIH5+fn5+fn5+fn4gKi9cblxuICAgICAgICAgICAgJCh3aW5kb3cpLnNjcm9sbChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoJCh0aGlzKS5zY3JvbGxUb3AoKSA+PSAxMDApIHtcbiAgICAgICAgICAgICAgICAgICAgJCgnLnJldHVybi10by10b3AnKS5hZGRDbGFzcygncmV0dXJuLXRvLXRvcC0tdmlzaWJsZScpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICQoJy5yZXR1cm4tdG8tdG9wJykucmVtb3ZlQ2xhc3MoJ3JldHVybi10by10b3AtLXZpc2libGUnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgJCgnI3JldHVybi10by10b3AnKS5jbGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAkKCdib2R5LGh0bWwnKS5hbmltYXRlKHtcbiAgICAgICAgICAgICAgICAgICAgc2Nyb2xsVG9wIDogMFxuICAgICAgICAgICAgICAgIH0sIDEwMDAsICdzd2luZycpO1xuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgLyogfn5+fn5+fn5+fiBGaXJzdCBjb250ZW50IGVsZW1lbnQgZml4IH5+fn5+fn5+fn4gKi9cblxuICAgICAgICAgICAgJCgnLmNvbnRlbnQnKS5wcmVwZW5kKCc8c3BhbiBjbGFzcz1cImZpcnN0LWVsZW1lbnQtZml4XCI+PC9zcGFuPicpO1xuICAgICAgICAgICAgJCgnYmxvY2txdW90ZScpLnByZXBlbmQoJzxzcGFuIGNsYXNzPVwiZmlyc3QtZWxlbWVudC1maXhcIj48L3NwYW4+Jyk7XG4gICAgICAgICAgICAkKCcucGFuZWwnKS5wcmVwZW5kKCc8c3BhbiBjbGFzcz1cImZpcnN0LWVsZW1lbnQtZml4XCI+PC9zcGFuPicpO1xuXG5cbiAgICAgICAgICAgIC8qIH5+fn5+fn5+fn4gTW9iaWxlIG5hdmlnYXRpb24gfn5+fn5+fn5+fiAqL1xuXG4gICAgICAgICAgICAkKCcjbW9iaWxlLW5hdmlnYXRpb24gLm5hdmlnYXRpb24gbGkgYScpLmFkZENsYXNzKCdtbS1mdWxsc3Vib3BlbicpO1xuXG5cbiAgICAgICAgICAgIC8qIH5+fn5+fn5+fn4gTWFrZSBkcm9wZG93bnMgdmlzaWJsZSBvbiBob3ZlciB+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgICAgICQoJ3VsLm5hdmJhci1uYXYgbGkuZHJvcGRvd24nKS5ob3ZlcihmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAkKHRoaXMpLmZpbmQoJy5kcm9wZG93bi1tZW51Jykuc3RvcCh0cnVlLCB0cnVlKS5kZWxheSg1MCkuZmFkZUluKCk7XG4gICAgICAgICAgICB9LCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAkKHRoaXMpLmZpbmQoJy5kcm9wZG93bi1tZW51Jykuc3RvcCh0cnVlLCB0cnVlKS5kZWxheSg1MCkuZmFkZU91dCgpO1xuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgLyogfn5+fn5+fn5+fiBEZWxldGUgZW1wdHkgPHA+IGVsZW1lbnRzIH5+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgICAgICQoJ3AnKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHZhciAkdGhpcyA9ICQodGhpcyk7XG4gICAgICAgICAgICAgICAgaWYoJHRoaXMuaHRtbCgpLnJlcGxhY2UoL1xcc3wmbmJzcDsvZywgJycpLmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgICAgICAgICAgJHRoaXMucmVtb3ZlKCk7XG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgICAgICAvKiB+fn5+fn5+fn5+IENoYW5nZSBuYXZpZ2F0aW9uIGFmdGVyIHNjcm9sbCB+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgICAgICQod2luZG93KS5zY3JvbGwoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKCQodGhpcykuc2Nyb2xsVG9wKCkgPj0gMTAwKSB7XG4gICAgICAgICAgICAgICAgICAgICQoJy5tYWluLWhlYWRlcicpLmFkZENsYXNzKCdtYWluLWhlYWRlci0tc2Nyb2xsZWQnKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAkKCcubWFpbi1oZWFkZXInKS5yZW1vdmVDbGFzcygnbWFpbi1oZWFkZXItLXNjcm9sbGVkJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgLyogfn5+fn5+fn5+fiBSZXBsYWNlIGFsbCBTVkcgaW1hZ2VzIHdpdGggaW5saW5lIFNWRyB+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgICAgIGpRdWVyeSgnaW1nLnN2ZycpLmVhY2goZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICB2YXIgJGltZyA9IGpRdWVyeSh0aGlzKTtcbiAgICAgICAgICAgICAgICB2YXIgaW1nSUQgPSAkaW1nLmF0dHIoJ2lkJyk7XG4gICAgICAgICAgICAgICAgdmFyIGltZ0NsYXNzID0gJGltZy5hdHRyKCdjbGFzcycpO1xuICAgICAgICAgICAgICAgIHZhciBpbWdVUkwgPSAkaW1nLmF0dHIoJ3NyYycpO1xuXG4gICAgICAgICAgICAgICAgalF1ZXJ5LmdldChpbWdVUkwsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyICRzdmcgPSBqUXVlcnkoZGF0YSkuZmluZCgnc3ZnJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYodHlwZW9mIGltZ0lEICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgJHN2ZyA9ICRzdmcuYXR0cignaWQnLCBpbWdJRCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZih0eXBlb2YgaW1nQ2xhc3MgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAkc3ZnID0gJHN2Zy5hdHRyKCdjbGFzcycsIGltZ0NsYXNzKycgcmVwbGFjZWQtc3ZnJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAkc3ZnID0gJHN2Zy5yZW1vdmVBdHRyKCd4bWxuczphJyk7XG4gICAgICAgICAgICAgICAgICAgICRpbWcucmVwbGFjZVdpdGgoJHN2Zyk7XG4gICAgICAgICAgICAgICAgfSwgJ3htbCcpO1xuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgLyogfn5+fn5+fn5+fiBQbGF5IElmcmFtZSBWaWRlbyB+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgICAgICQoJy52aWRlb19fcGxheS1idXR0b24nKS5jbGljayhmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICQodGhpcykucGFyZW50KCkuYWRkQ2xhc3MoJ25vLWFmdGVyJyk7XG4gICAgICAgICAgICAgICAgJCh0aGlzKS5wYXJlbnQoKS5odG1sKCc8aWZyYW1lIHNyYz1cIicrJCh0aGlzKS5kYXRhKCd2aW1lby1zcmMnKSsnP3BvcnRyYWl0PTAmdGl0bGU9MCZiYWRnZT0wJmJ5bGluZT0wJmF1dG9wbGF5PTFcIiB3aWR0aD1cIjEwMCVcIiBoZWlnaHQ9XCIxMDAlXCIgZnJhbWVib3JkZXI9XCIwXCIgd2Via2l0QWxsb3dGdWxsU2NyZWVuIG1vemFsbG93ZnVsbHNjcmVlbiBhbGxvd0Z1bGxTY3JlZW4+PC9pZnJhbWU+Jyk7XG4gICAgICAgICAgICB9KTtcblxuICAgIH0pO1xuXG5cbiAgICAkKHdpbmRvdykuYmluZCgnbG9hZCByZXNpemUgb3JpZW50YXRpb25DaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgLyogfn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fiAqL1xuICAgICAgICAvKiB+fn5+fn5+fn5+IEZ1bmN0aW9ucyB+fn5+fn5+fn5+ICovXG4gICAgICAgIC8qIH5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn4gKi9cblxuICAgICAgICAgICAgLyogfn5+fn5+fn5+fiBBT1MgUmVmcmVzaCB+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgICAgIC8vIEFPUy5yZWZyZXNoKCk7XG5cblxuICAgICAgICAgICAgLyogfn5+fn5+fn5+fiBCb290c3RyYXAgbW9kYWwgbWFyZ2luIHRvcCBpZiBXUCBhZG1pbiBleGlzdCB+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgICAgIGlmKCQoJyN3cGFkbWluYmFyJykubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgJCgnLm1vZGFsJykub24oJ3Nob3duLmJzLm1vZGFsJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIFdQQWRtaW5CYXJIZWlnaHQgPSAkKCcjd3BhZG1pbmJhcicpLmhlaWdodCgpO1xuICAgICAgICAgICAgICAgICAgICAkKCcubW9kYWwnKS5jc3MoXCJtYXJnaW4tdG9wXCIsIChXUEFkbWluQmFySGVpZ2h0ICsgMzApKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICAvKiB+fn5+fn5+fn5+IFN0aWNreSBGb290ZXIgfn5+fn5+fn5+fiAqL1xuXG4gICAgICAgICAgICBpZighJCgnLmhvbWVwYWdlLXRlbXBsYXRlJykubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgJChmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgICAgICB2YXIgJGZvb3RlciA9ICQoJy5mb290ZXItd3JhcHBlcicpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciBwb3MgPSAkZm9vdGVyLnBvc2l0aW9uKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBoZWlnaHQgPSAoJCh3aW5kb3cpLm91dGVySGVpZ2h0KCkgLSBwb3MudG9wKSAtICgkZm9vdGVyLm91dGVySGVpZ2h0KCkgKyAyKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaGVpZ2h0ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgJGZvb3Rlci5jc3MoJ21hcmdpbi10b3AnLCBoZWlnaHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgfSk7XG5cblxuICAgIC8qIH5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn4gKi9cbiAgICAvKiB+fn5+fn5+fn5+IFJlc3VhYmxlIGZ1bmN0aW9ucyB+fn5+fn5+fn5+ICovXG4gICAgLyogfn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fn5+fiAqL1xuXG4gICAgICAgIC8qIH5+fn5+fn5+fn4gQ2hlY2sgaWYgY3VycmVudCBkZXZpY2VzIGlzIG1vYmlsZSB+fn5+fn5+fn5+ICovXG5cbiAgICAgICAgZnVuY3Rpb24gaXNNb2JpbGUoKSB7XG4gICAgICAgICAgICB0cnl7IGRvY3VtZW50LmNyZWF0ZUV2ZW50KFwiVG91Y2hFdmVudFwiKTsgcmV0dXJuIHRydWU7IH1cbiAgICAgICAgICAgIGNhdGNoKGUpeyByZXR1cm4gZmFsc2U7IH1cbiAgICAgICAgfVxuXG59KShqUXVlcnkpOyJdfQ==
