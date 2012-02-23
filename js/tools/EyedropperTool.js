/* <copyright>
This file contains proprietary software owned by Motorola Mobility, Inc.<br/>
No rights, expressed or implied, whatsoever to this software are provided by Motorola Mobility, Inc. hereunder.<br/>
(c) Copyright 2011 Motorola Mobility, Inc.  All Rights Reserved.
</copyright> */

var Montage = require("montage/core/core").Montage,
    ElementsMediator = require("js/mediators/element-mediator").ElementMediator,
    drawUtils = require("js/helper-classes/3D/draw-utils").DrawUtils,
    vecUtils = require("js/helper-classes/3D/vec-utils").VecUtils,
    toolBase = require("js/tools/ToolBase").toolBase;

exports.EyedropperTool = Montage.create(toolBase, {

    _isMouseDown: { value: false },
    _previousColor: { value: null},
    _color: { value: null},
    _elementUnderMouse: { value: null },
    _imageDataCanvas: { value: null },
    _imageDataContext: { value: null },

    Configure: {
        value: function ( doActivate )
		{
			if (doActivate)
			{
                NJevent("enableStageMove");
			}
			else
			{
                NJevent("disableStageMove");
			}
        }
    },

    HandleLeftButtonDown: {
        value : function ( event ) {
            this._isMouseDown = true;
            this._previousColor =
                this.application.ninja.colorController[this.application.ninja.colorController.colorModel.input].css;

            this._updateColorFromPoint(event);
       }
    },

    HandleMouseMove: {
        value : function (event)
		{
            if(this._escape)
            {
                this._isMouseDown = false;
                this._escape = false;
                this._elementUnderMouse = null;
                this._deleteImageDataCanvas();
            }
            if(this._isMouseDown)
            {
                this._updateColorFromPoint(event);
            }
		}
	},

    HandleLeftButtonUp: {
        value : function (event) {
			{
                this._isMouseDown = false;

                if(this._escape)
                {
                    this._escape = false;
                }

                this._updateColor(this._color);

                this._color = null;

                this._elementUnderMouse = null;
                this._deleteImageDataCanvas();
            }
        }
    },

    HandleEscape: {
        value: function(event) {
            if(this._color && this._color.value)
            {
                var color = this.application.ninja.colorController.getColorObjFromCss(this._previousColor);

                if (color && color.value) {
                    color.value.wasSetByCode = true;
                    color.value.type = 'change';
                    if (color.value.a) {
                        this.application.ninja.colorController.colorModel.alpha = {value: color.value.a,
                                                                                    wasSetByCode: true,
                                                                                    type: 'change'};
                    }
                    this.application.ninja.colorController.colorModel[color.mode] = color.value;
                    this._color = null;
                }
            }
            this._escape = true;
        }
    },

    _updateColorFromPoint: {
        value : function (event) {
            var c,
                color,
                obj = this.application.ninja.stage.GetElement(event);
            if (obj)
            {
                if(this.application.ninja.currentDocument.inExclusion(obj) !== -1)
                {
                    this._elementUnderMouse = null;
                    this._deleteImageDataCanvas();
                    return;
                }
                this._elementUnderMouse = obj;
                // Depending on the object type, we need to get different colors
                if(obj.elementModel.selection === "image")
                {
                    c = this._getColorAtPoint(obj, event);
                    if(c)
                    {
                        color = this.application.ninja.colorController.getColorObjFromCss(c);
                    }
                }
                else if (obj.elementModel.selection === "canvas")
                {
                    this._deleteImageDataCanvas();

                    var pt = webkitConvertPointFromPageToNode(obj,
                                                                new WebKitPoint(event.pageX, event.pageY)),
                        ctx = obj.getContext("2d");

                    c = this._getColorFromCanvas(ctx, pt);
                    if(c)
                    {
                        color = this.application.ninja.colorController.getColorObjFromCss(c);
                    }
                }
                else
                {
                    this._deleteImageDataCanvas();

                    c = ElementsMediator.getColor(obj, this._isOverBackground(obj, event));
                    if(c)
                    {
                        color = this.application.ninja.colorController.getColorObjFromCss(c.color.css);
                    }
                }

                if (color && color.value) {
                    color.value.wasSetByCode = true;
                    color.value.type = 'changing';
                    if (color.value.a) {
                        this.application.ninja.colorController.colorModel.alpha = {value: color.value.a,
                                                                                    wasSetByCode: true,
                                                                                    type: 'changing'};
                    }
                    this.application.ninja.colorController.colorModel[color.mode] = color.value;
                    this._color = color;
                }
            }
            else
            {
                this._elementUnderMouse = null;
                this._deleteImageDataCanvas();
            }

        }
    },

    _updateColor: {
        value: function(color) {
            if (color && color.value) {
                var input = this.application.ninja.colorController.colorModel.input;

                if(input === "fill")
                {
                    this.application.ninja.colorController.colorToolbar.fill_btn.color(color.mode, color.value);
                }
                else
                {
                    this.application.ninja.colorController.colorToolbar.stroke_btn.color(color.mode, color.value);
                }

                // Updating color chips will set the input type to "chip", so set it back here.
                this.application.ninja.colorController.colorModel.input = input;

                color.value.wasSetByCode = true;
                color.value.type = 'change';
                if (color.value.a) {
                    this.application.ninja.colorController.colorModel.alpha = {value: color.value.a,
                                                                                wasSetByCode: true,
                                                                                type: 'change'};
                }
                this.application.ninja.colorController.colorModel[color.mode] = color.value;
                this._previousColor = color.value.css;
            }
        }
    },

    // TODO - We don't want to calculate this repeatedly
    _isOverBackground: {
        value: function(elt, event)
        {
            var border = ElementsMediator.getProperty(elt, "border", parseFloat);

            if(border)
            {
                var bounds3D,
                    innerBounds = [],
                    pt = webkitConvertPointFromPageToNode(this.application.ninja.stage.canvas, new WebKitPoint(event.pageX, event.pageY)),
                    bt = ElementsMediator.getProperty(elt, "border-top", parseFloat),
                    br = ElementsMediator.getProperty(elt, "border-right", parseFloat),
                    bb = ElementsMediator.getProperty(elt, "border-bottom", parseFloat),
                    bl = ElementsMediator.getProperty(elt, "border-left", parseFloat);

//                this.application.ninja.stage.viewUtils.setViewportObj( elt );
                bounds3D = this.application.ninja.stage.viewUtils.getElementViewBounds3D( elt );
//                console.log("bounds");
//                console.dir(bounds3D);

                var xAdj = bl || border,
                    yAdj = bt || border;
                innerBounds.push([bounds3D[0][0] + xAdj, bounds3D[0][1] + yAdj, 0]);

                yAdj += bb || border;
                innerBounds.push([bounds3D[1][0] + xAdj, bounds3D[1][1] - yAdj, 0]);

                xAdj += br || border;
                innerBounds.push([bounds3D[2][0] - xAdj, bounds3D[2][1] - yAdj, 0]);

                yAdj = bt || border;
                innerBounds.push([bounds3D[3][0] - xAdj, bounds3D[3][1] + yAdj, 0]);
//                console.log("innerBounds");
//                console.dir(innerBounds);

                var tmpPt = this.application.ninja.stage.viewUtils.globalToLocal([pt.x, pt.y], elt);
                var x = tmpPt[0],
                    y = tmpPt[1];

                if(x < innerBounds[0][0]) return false;
                if(x > innerBounds[2][0]) return false;
                if(y < innerBounds[0][1]) return false;
                if(y > innerBounds[1][1]) return false;
            }
            return true;
        }
    },

    _getColorAtPoint: {
        value: function(elt, event)
        {
            if(!this._imageDataCanvas)
            {
                this._imageDataCanvas = document.createElement("canvas");

                this._applyElementStyles(elt, this._imageDataCanvas, ["display", "position", "width", "height",
                                                                "-webkit-transform", "-webkit-transform-style"]);

                var l = this.application.ninja.elementMediator.getProperty(elt, "left", parseInt),
                    t = this.application.ninja.elementMediator.getProperty(elt, "top", parseInt),
                    w = this.application.ninja.elementMediator.getProperty(elt, "width", parseInt),
                    h = this.application.ninja.elementMediator.getProperty(elt, "height", parseInt);

                var eltCoords = this.application.ninja.stage.toViewportCoordinates(l, t);
                this._imageDataCanvas.style.left = eltCoords[0] + "px";
                this._imageDataCanvas.style.top = eltCoords[1] + "px";
                this._imageDataCanvas.width = w;
                this._imageDataCanvas.height = h;

//                this.application.ninja.currentDocument.documentRoot.appendChild(this._imageDataCanvas);

                this._imageDataContext = this._imageDataCanvas.getContext("2d");
                this._imageDataContext.drawImage(elt, 0, 0);
            }

            var pt = webkitConvertPointFromPageToNode(this.application.ninja.stage.canvas,
                                                        new WebKitPoint(event.pageX, event.pageY));

            var tmpPt = this.application.ninja.stage.viewUtils.globalToLocal([pt.x, pt.y], elt);

            return this._getColorFromCanvas(this._imageDataContext, tmpPt);
        }
    },

    _getColorFromCanvas: {
        value: function(ctx, pt)
        {
//            var imageData = ctx.getImageData(pt.x, pt.y, 1, 1).data;
            var imageData = ctx.getImageData(pt[0], pt[1], 1, 1).data;
            if(imageData)
            {
                return ("rgba(" + imageData[0] + "," + imageData[1] + "," + imageData[2] + "," + imageData[3] + ")");
            }
            else
            {
                return null;
            }
        }
    },

    _deleteImageDataCanvas : {
        value: function()
        {
            if(this._imageDataCanvas)
            {
//                this.application.ninja.currentDocument.documentRoot.removeChild(this._imageDataCanvas);
                this._imageDataCanvas = null;
                this._imageDataContext = null;
            }
        }
    },

    _applyElementStyles : {
        value: function(fromElement, toElement, styles) {
            styles.forEach(function(style) {
                var styleCamelCase = style.replace(/(\-[a-z])/g, function($1){return $1.toUpperCase().replace('-','');});
                toElement.style[styleCamelCase] = window.getComputedStyle(fromElement)[style];
            }, this);
        }
    }

});