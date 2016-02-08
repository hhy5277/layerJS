var pluginManager = require('../../../src/framework/pluginmanager.js');
var jsdom = require('jsdom').jsdom;

var commonViewTests = function(scenario, initFunction) {

  describe('(basis view tests) ' + scenario, function() {

    var document, window, $;
    var data, ViewType;

    beforeEach(function() {
      var init = initFunction();
      data = pluginManager.createModel(JSON.parse(JSON.stringify(init.data)));
      ViewType = init.ViewType;

      document = global.document = jsdom("<html><head><style id='wl-obj-css'></style></head><body></body></html>");
      window = global.window = document.defaultView;
      $ = document.querySelector;
    });

    it('will add a new DOM element when no element is provided', function() {
      var view = new ViewType(data);
      expect(view.el).not.toBeUndefined();
    });

    it('the DOM element will have the same tag as defined in the data model', function() {
      var view = new ViewType(data);
      expect(view.el.tagName.toUpperCase()).toBe(data.attributes.tag.toUpperCase());
    });

    it('will add a _wlView property to the DOM element', function() {
      var view = new ViewType(data);
      var element = view.el;
      expect(element._wlView === view).toBeTruthy();
    });

    it('when initialized with the noRender option true, the view doesn\'t get rendered', function() {
      var view = new ViewType(data, {
        noRender: true
      });

      expect(view.el).toBeDefined();
      expect(view.el.id).toBe('');
    });

    it('can be initialized with an existing element, without re-rendering', function() {
      var element = document.createElement('div');
      element.id = '1000';

      var view = new ViewType(data, {
        el: element
      });
      expect(view.el).toBe(element);
      expect(view.el.id).not.toBe(data.attributes.id);
    });


    it('will not automatic render the DOM element with data from it\'s dataModel', function() {
      var view = new ViewType(data);
      var element = view.el;

      expect(element.id).not.toBe(data.attributes.id);
    });


    it('can be initialized with an existing element, forcing re-rendering', function() {
      var element = document.createElement('div');
      element.id = '1000';
      var view = new ViewType(data, {
        el: element,
        forceRender: true
      });
      expect(view.el).toBe(element);
      expect(view.el.id).toBe(data.attributes.id.toString()); // changed
    });

    it('cannot add view to existing element if that is already connected to another view', function() {
      var element = document.createElement('div');
      element.id = '1000';
      element._wlView = {};
      var options = {
        el: element
      };

      var fun = function() {
        var cv = new viewType(data, options);
      };
      expect(fun).toThrow()
    });

    it('is styled in a separte stylesheet if a style is defined', function() {
      var view = new ViewType(data);

      var expected = expect(document.getElementById('wl-obj-css').innerHTML);
      if (data.attributes.style) {
        expected.toContain("#wl-obj-" + data.attributes.id + "{" + data.attributes.style + "}");
      } else {
        expected.not.toContain("#wl-obj-" + data.attributes.id);
      }
    });

    it('will add a data-wl-id attribute DOM element', function() {
      var view = new ViewType(data);

      var element = view.el;
      var data_wl_id = element.getAttribute('data-wl-id');
      expect(data_wl_id).toBe(data.attributes.id.toString());
    });

    it('will add a data-wl-type attribute DOM element', function() {
      var view = new ViewType(data);

      var element = view.el;
      var data_wl_type = element.getAttribute('data-wl-type');
      expect(data_wl_type).toBe(data.attributes.type.toString());
    });

    it('will add a default class to the DOM element', function() {
      var view = new ViewType(data);

      var element = view.el;
      var classAttribute = element.getAttribute('class');
      expect(classAttribute).toContain('object-default object-' + data.attributes.type);
    });

    it('will add classes that are defined in a data to the DOM element', function() {
      var view = new ViewType(data);

      var element = view.el;
      var classAttribute = element.getAttribute('class');
      expect(classAttribute).toContain(data.attributes.classes);
    });

    it('will add classes that are defined in a data to the DOM element', function() {
      var view = new ViewType(data);

      var element = view.el;
      var classAttribute = element.getAttribute('class');
      expect(classAttribute).toContain(data.attributes.classes);
    });

    it('will put the x property as the left property of the style of the DOM element when renderPosition is called', function() {
      var view = new ViewType(data);
      view.renderPosition();

      var element = view.el;
      var style = element.style;

      expect(element.style.left).toBe(data.attributes.x + 'px');
    });

    it('will put the y property as the top property of the style of the DOM element when renderPosition is called', function() {
      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      expect(element.style.top).toBe(data.attributes.y + 'px');
    });

    it('when the y property is undefined the position property will be absolute of the style of the DOM element when renderPosition is called', function() {
      data.attributes.y = undefined;
      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      expect(element.style.position).toBe('absolute');
    });

    it('when the x property is undefined the position property will be absolute of the style of the DOM element when renderPosition is called', function() {
      data.attributes.x = undefined;

      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      expect(element.style.position).toBe('absolute');
    });

    it('when the x and y property are undefined the position property will be static of the style of the DOM element when renderPosition is called', function() {
      data.attributes.y = undefined;
      data.attributes.x = undefined;
      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      expect(element.style.position).toBe('static');
    });

    it('will put a scaleX, scaleY in the transform property of the style of the DOM element will be set when renderPosition is called', function() {
      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      expect(element.style.transform).toContain('scale(' + data.attributes.scaleX + ',' + data.attributes.scaleY + ')');
    });

    it('will put the rotation in the transform property of the style of the DOM element will be set when renderPosition is called', function() {
      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      if (data.attributes.rotation)
        expect(element.style.transform).toContain('rotate(' + Math.round(data.attributes.rotation) + 'deg)');
      else
        expect(element.style.transform).not.toContain('rotate');
    });

    it('will put the zIndex in the zIndex property of the style of the DOM element will be set when renderPosition is called', function() {
      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      expect(element.style.zIndex).toBe(data.attributes.zIndex !== undefined ? data.attributes.zIndex.toString() : '');
    });

    it('will set the display property in the style of the DOM element when renderPosition is called', function() {
      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      var displaySetting = data.attributes.hidden ? 'none' : '';

      expect(element.style.display).toBe(displaySetting);
    });

    it('will put the width in the width property of the style of the DOM element will be set when renderPosition is called', function() {
      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      var width = data.attributes.width !== undefined ? data.attributes.width + 'px' : '';

      expect(element.style.width).toBe(width);
    });

    it('will put the width in the width property of the style of the DOM element will be set when renderPosition is called', function() {
      var view = new ViewType(data);
      view.renderPosition();
      var element = view.el;
      var style = element.style;

      var height = data.attributes.height !== undefined ? data.attributes.height + 'px' : '';

      expect(element.style.height).toBe(height);
    });

    it('will remove the linked DOM element from is parent when destroy is called', function() {
      var parent = document.createElement('div');
      var child = document.createElement('div');
      parent.appendChild(child);

      expect(parent.children.length).toBe(1);

      var view = new ViewType(data, {
        el: child
      });
      view.destroy();

      expect(parent.children.length).toBe(0);
      expect(child.parent).toBeUndefined();
    });

    it('will set the href attribute of the anchor DOM element to the link_to attribute of the data model', function() {
      var view = new ViewType(data);
      var element = view.el;

      if (data.attributes.tag.toUpperCase() == 'A') {
        expect(element.hasAttribute('href')).toBeTruthy();
        expect(element.getAttribute('href')).toBe(data.attributes.linkTo ? data.attributes.linkTo : '');
      } else {
        expect(element.hasAttribute('href')).toBeFalsy();
      }
    });

    it('will set the target attribute of the anchor DOM element to the link_target attribute of the data model', function() {
      var view = new ViewType(data);
      var element = view.el;

      if (data.attributes.tag.toUpperCase() == 'A') {
        expect(element.hasAttribute('target')).toBeTruthy();
        expect(element.getAttribute('target')).toBe(data.attributes.linkTarget ? data.attributes.linkTarget : '_self');
      } else {
        expect(element.hasAttribute('target')).toBeFalsy();
      }
    });

    it('will contain a Parse method to read the data from a DOM element', function() {
      expect(ViewType.Parse).toBeDefined();
    });

    it('the Parse method will return a data object based on a DOM element', function() {
      var element = document.createElement('a');
      element.setAttribute('data-wl-id', 1);
      element.setAttribute('data-wl-type', data.attributes.type);
      element.style.display = 'none';
      element.style.zIndex = 2;
      element.style.width = '100px';
      element.style.height = '200px';
      element.style.left = '50px';
      element.style.top = '25px';
      element.className = 'object-default object-' + data.attributes.type + ' someClass';
      element.setAttribute('href', 'url');
      element.setAttribute('target', '_self');

      var dataObject = ViewType.Parse(element);

      expect(dataObject).toBeDefined();
      expect(dataObject.el).toBe(element);
      expect(dataObject.id).toBe('1');
      expect(dataObject.type).toBe(data.attributes.type);
      expect(dataObject.tag).toBe('A');
      expect(dataObject.classes).toBe(' someClass');
      expect(dataObject.linkTo).toBe('url');
      expect(dataObject.linkTarget).toBe('_self');
      expect(dataObject.x).toBe('50');
      expect(dataObject.y).toBe('25');
      expect(dataObject.hidden).toBe(true);
      expect(dataObject.zIndex).toBe('2');
      expect(dataObject.width).toBe('100');
      expect(dataObject.height).toBe('200');
    });
  });
};

module.exports = commonViewTests;
