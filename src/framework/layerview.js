'use strict';
var $ = require('./domhelpers.js');
var Kern = require('../kern/Kern.js');
var pluginManager = require('./pluginmanager.js');
var layoutManager = require('./layoutmanager.js');
var LayerData = require('./layerdata.js');
var GroupView = require('./groupview.js');

/**
 * A View which can have child views
 * @param {LayerData} dataModel
 * @param {object}        options
 * @extends GroupView
 */

var LayerView = GroupView.extend({
  constructor: function(dataModel, options) {
    options = options || {};
    var that = this;
    this._preparedTransitions = {};
    this.inTransform = false;
    this._layout = new(layoutManager.get(dataModel.attributes.layoutType))(this);
    // we need to create the divs here instead of in the Objview constructor
    this.outerEl = options.el || document.createElement(dataModel.attributes.tag || 'div');
    // do we already have a scroller div?
    var hasScroller = this.outerEl.childNodes.length === 1 && this.outerEl.childNodes[0].getAttribute('data-wl-helper') === 'scroller';
    this.innerEl = this.outerEl;
    // should we not have a scroller?
    if (hasScroller && !dataModel.attributes.nativeScroll) $.unwrapChildren(this.outerEl);
    // should we have a scroller but don't have one?
    if (!hasScroller && dataModel.attributes.nativeScroll) {
      // set el to scroller
      this.innerEl = $.wrapChildren(this.outerEl);
      hasScroller = true;
    }
    if (hasScroller) {
      this.innerEl = this.outerEl.childNodes[0];
      this.outerEl.className += ' nativescroll';
      //      Kern._extend(this.outerEl.style,{left:"0px",right:"0px",top:"0px",bottom:"0px"});
      //      Kern._extend(this.innerEl.style,{left:"0px",right:"0px",top:"0px"});
    }
    // mark scroller as scroller in HTML
    if (hasScroller) this.innerEl.setAttribute('data-wl-helper', 'scroller');
    // call super constructor

    GroupView.call(this, dataModel, Kern._extend({}, options, {
      noRender: true
    }));

    // this is my stage and add listener to keep it updated
    this.stage = this.parent;
    this.on('parent', function() {
      that.stage = that.parent;
      // FIXME trigger adaption to new stage
    });
    // set current frame from data object or take first child
    this.currentFrame = (this.data.attributes.defaultFrame && this.findChildView(this.data.attributes.defaultFrame)) || (this.data.attributes.children[0] && this.getChildView(this.data.attributes.children[0]));
    if (!options.noRender && (options.forceRender || !options.el)) {
      this.render();
    }
    // set the initial frame if possible
    if (this.currentFrame) {
      this.setFrame(this.currentFrame.data.attributes.name);
    }
    // listen to scroll events
    this.outerEl.addEventListener('scroll', function() {
      var keys = Object.keys(that._preparedTransitions);
      var i;
      for (i = 0; i < keys.length; i++) {
        // mark prepared transitions direty because they assume a wrong scroll transform
        // don't delete prepared transitions because everything else is still valid
        that._preparedTransitions[i]._dirty = true;
      }
    });
  },
  /**
   * set current frame immidiately without transition/animation
   *
   * @param {string} framename - the frame to be active
   * @returns {void}
   */
  setFrame: function(framename) {
    if (!this.stage) {
      return;
    }
    var that = this;
    var frame = this.getChildViewByName(framename);
    if (!frame) throw "transformTo: " + framename + " does not exist in layer";
    this._loadFrame(frame).then(function() {
      // make sure that stage (and assumably also the frame) have been rendered and hence have dimension even without fixed width/height properties.
      // NOTE: _loadFrame() will not ensure this if the frame is already in place and has not diplay:none
      return that.stage.waitForDimensions();
    }).then(function() {
      that.currentFrame = frame;
      var tfd = that._currentFrameTransformData = frame.getTransformData(that.stage);
      if (frame.data.attributes.nativeScroll) {
        that._currentTransform = that._calculateScrollTransform(0, 0); // no transforms as scrolling is achieved by native scrolling
        // set inner size to set up native scrolling
        // FIXME: we shouldn't set the dimension in that we don't scroll
        if (tfd.isScrollY) {
          that.innerEl.style.height = tfd.height;
        } else {
          that.innerEl.style.height = "100%";
        }
        if (tfd.isScrollX) {
          that.innerEl.style.width = tfd.width;
        } else {
          that.innerEl.style.width = "100%";
        }
        // apply inital scroll position
        that.outerEl.scrollLeft = tfd.scrollX * tfd.scale;
        that.outerEl.scrollTop = tfd.scrollY * tfd.scale;
      } else {
        // in transformscroll we add a transform representing the scroll position.
        that.innerEl.style.height = 0;
        that.innerEl.style.width = 0;
        that._currentTransform = that._calculateScrollTransform(tfd.scrollX * tfd.scale, tfd.scrollY * tfd.scale);
      }
      // now perfom immidiate transformation
      that._layout.setFrame(frame, that._currentFrameTransformData, that._currentTransform);
    });
  },
  /**
   * make sure frame is rendered (i.e. has display: block)
   * Later: make sure frame is loaded and added to document
   * FIXME: should that go into layout?
   *
   * @param {Type} Name - Description
   * @returns {Type} Description
   */
  _loadFrame: function(frame) {
    var finished = new Kern.Promise();
    if (document.body.contains(frame.outerEl) && window.getComputedStyle(frame.outerEl).display !== 'none') {
      finished.resolve();
    } else {
      // FIXME: add to dom if not in dom
      // set display block
      frame.outerEl.style.display = 'block';
      // frame should not be visible; opacity is the best as "visibility" can be reverted by nested elements
      frame.outerEl.style.opacity = '0';
      // wait until rendered;
      $.postAnimationFrame(function() {
        finished.resolve();
      });
    }
    return finished;
  },
  /**
   * Calculate all pre and post poisitions (for current frame and target frame). Place target frame at pre position
   *
   * @param {FrameView} frame - the target frame of the transition
   * @param {Object} transition - the transition record
   * @returns {Promise} promis which is resolved if target frame is positioned with value t containing the pre and post transforms
   */
  _prepareTransition: function(frame, transition) {
    var that = this;
    // check if transition is already prepared
    var pt = this._preparedTransitions[frame.data.attributes.name];
    if (pt && !pt._dirty) {
      var p = new Kern.Promise();
      p.resolve(pt);
      return p;
    }
    // ensure frame is there
    return this._loadFrame(frame).then(function() {
      // get target frame transformdata
      var tfd = (pt && pt._transformData) || frame.getTransformData(that.stage, transition.startPosition);
      // calculate target transform based on current and future scroll positions
      var targetTransform;
      if (frame.data.attributes.nativeScroll) {
        // in nativescroll, the scroll position is not applied via transform, but we need to compensate for a displacement due to the different scrollTop/Left values in the current frame and the target frame. This displacement is set to 0 after correcting the scrollTop/Left in the transitionEnd listener in transitionTo()
        var shiftX = that.outerEl.scrollLeft - (tfd.scrollX * tfd.scale || 0);
        var shiftY = that.outerEl.scrollTop - (tfd.scrollY * tfd.scale || 0);
        targetTransform = that._calculateScrollTransform(shiftX, shiftY);
      } else {
        // in transformscroll we add a transform representing the scroll position.
        targetTransform = that._calculateScrollTransform(tfd.scrollX * tfd.scale, tfd.scrollY * tfd.scale);
      }
      // if transition was prepared but is _dirty
      if (pt) {
        return this._layout.updateTransition(frame, pt._layoutData, this._currentTransform, targetTransform).then(function(t) {
          // new preposition have bee applied, now update preparedTransition record
          delete pt._dirty;
          pt._layoutData = t;
          pt._transform = targetTransform;
          return pt;
        });
      }
      // we need to calculate a full
      //return a promise for setting intial target frame position
      return that._layout.prepareTransition(frame, transition.type || "default", that._currentFrameTransformData, tfd, that._currentTransform, targetTransform).then(function(t) {
        // store prepared transition information
        return (that._preparedTransitions[frame.data.attributes.name] = {
          _transformData: tfd,
          _transform: targetTransform,
          _layoutData: t
        });
      });
    });
  },
  /**
   * internal function
   *
   * @param {Type} Name - Description
   * @returns {Type} Description
   */
  _calculateScrollTransform: function(scrollX, scrollY) {
    return "translate3d(" + scrollX + "px," + scrollY + "px,0px)";
  },
  /**
   * transform to a given frame in this layer with given transition
   *
   * @param {string} framename - (optional) frame name to transition to
   * @param {Object} transition - (optional) transition object
   * @returns {Type} Description
   */
  transitionTo: function(framename, transition) {
    // is framename  omitted?
    if (typeof framename === 'object') {
      transition = framename;
      framename = transition.frame;
    }
    transition = transition || {
      type: 'default'
        // FIXME: add more default values like timing
    };
    framename = framename || transition.framename;
    if (!framename) throw "transformTo: no frame given";
    var frame = this.getChildViewByName(framename);
    if (!frame) throw "transformTo: " + framename + " does not exist in layer";
    var that = this;
    this._prepareTransition(frame, transition).then(function(preparedTransition) {
      that.inTransform = true;
      // var ctfd = that._currentFrameTransformData;
      var tfd = preparedTransition._transformData;
      that._layout.executeTransition(frame, transition, preparedTransition._layoutData, that._currentTransform, preparedTransition._transform).then(function() {
        // now that the transform finished we have to update the shift (transform ) and the scrollTop/Left and update length when native scrolling
        console.log(that.currentFrame.data.attributes.name);
        that.inTransform = false;
        if (that.data.attributes.nativeScroll) {
          // transform in native scroll should be 0 (was set differently during transition to compansate old scroll position)
          that._layout.setTransform(that._calculateScrollTransform(0, 0), tfd);
          if (tfd.isScrollY) {
            that.innerEl.style.height = tfd.height;
            that.outerEl.scrollTop = tfd.scrollY;
          } else {
            that.innerEl.style.height = "100%";
            that.outerEl.scrollTop = 0;
          }
          if (tfd.isScrollX) {
            that.innerEl.style.width = tfd.width;
            that.outerEl.scrollLeft = tfd.scrollX;
          } else {
            that.innerEl.style.width = "100%";
            that.outerEl.scrollLeft = 0;
          }
        }
      });
      // set information of new current frame
      // NOTE: this happens before the transition ends!
      that.currentFrame = frame;
      that._preparedTransitions = {};
      that._currentFrameTransformData = preparedTransition._transformData;
      that._currentTransform = preparedTransition._transform;
    });
  },
  /**
   * overriden default behavior of groupview
   *
   * @param {ObjView} childView - the child view that has changed
   * @returns {Type} Description
   */
  _renderChildPosition: function(childView) {
    childView.disableObserver();
    this._layout.positionFrame(childView);
    childView.enableObserver();
  }
}, {
  Model: LayerData,
  parse: GroupView.parse
});

pluginManager.registerType('layer', LayerView);

module.exports = LayerView;
