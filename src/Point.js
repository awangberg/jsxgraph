/*
    Copyright 2008-2011
        Matthias Ehmann,
        Michael Gerhaeuser,
        Carsten Miller,
        Bianca Valentin,
        Alfred Wassermann,
        Peter Wilfahrt

    This file is part of JSXGraph.

    JSXGraph is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    JSXGraph is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with JSXGraph.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * @fileoverview The geometry object Point is defined in this file. Point stores all
 * style and functional properties that are required to draw and move a point on
 * a board.
 */


/**
 * A point is the basic geometric element. Based on points lines and circles can be constructed which can be intersected
 * which in turn are points again which can be used to construct new lines, circles, polygons, etc. This class holds methods for
 * all kind of points like free points, gliders, and intersection points.
 * @class Creates a new point object. Do not use this constructor to create a point. Use {@link JXG.Board#create} with
 * type {@link Point}, {@link Glider}, or {@link Intersection} instead.  
 * @augments JXG.GeometryElement
 * @param {string|JXG.Board} board The board the new point is drawn on.
 * @param {Array} coordinates An array with the affine user coordinates of the point.
 * @param {Object} attributes An object containing visual properties like in {@link JXG.Options#point} and
 * {@link JXG.Options#elements}, and optional a name and a id.
 * @see JXG.Board#generateName
 * @see JXG.Board#addPoint
 */
JXG.Point = function (board, coordinates, attributes) {
    this.constructor(board, attributes, JXG.OBJECT_TYPE_POINT, JXG.OBJECT_CLASS_POINT);
    
    if (coordinates==null) {
        coordinates=[0,0];
    }
    /**
     * Coordinates of the point.
     * @type JXG.Coords
     * @private
     */
    this.coords = new JXG.Coords(JXG.COORDS_BY_USER, coordinates, this.board);
    this.initialCoords = new JXG.Coords(JXG.COORDS_BY_USER, coordinates, this.board);
    
    /**
     * Relative position on a line if point is a glider on a line.
     * @type Number
     * @private
     */
    this.position = null;

    /**
     * Determines whether the point slides on a polygon if point is a glider.
     * @type boolean
     * @default false
     * @private
     */
    this.onPolygon = false;
    
    /**
     * When used as a glider this member stores the object, where to glide on. To set the object to glide on use the method
     * {@link JXG.Point#makeGlider} and DO NOT set this property directly as it will break the dependency tree.
     * TODO: Requires renaming to glideObject
     * @type JXG.GeometryElement
     * @name Glider#slideObject
     */
    this.slideObject = null;

    this.Xjc = null;
    this.Yjc = null;

    // documented in GeometryElement
    this.methodMap = JXG.deepCopy(this.methodMap, {
        move: 'moveTo',
        glide: 'makeGlider',
        X: 'X',
        Y: 'Y',
        free: 'free',
        setPosition: 'setGliderPosition'
    });

    /**
     * Stores the groups of this point in an array of Group.
     * @type array
     * @see JXG.Group
     * @private
     */
    this.group = [];

    this.elType = 'point';

    /* Register point at board. */
    this.id = this.board.setId(this, 'P');
    this.board.renderer.drawPoint(this);
    this.board.finalizeAdding(this);

    this.createLabel();
};

/**
 * Inherits here from {@link JXG.GeometryElement}.
 */
JXG.Point.prototype = new JXG.GeometryElement();


JXG.extend(JXG.Point.prototype, /** @lends JXG.Point.prototype */ {
    /**
     * Checks whether (x,y) is near the point.
     * @param {int} x Coordinate in x direction, screen coordinates.
     * @param {int} y Coordinate in y direction, screen coordinates.
     * @type boolean
     * @return True if (x,y) is near the point, False otherwise.
     * @private
     */
    hasPoint: function (x,y) {
        var coordsScr = this.coords.scrCoords, r;
        r = parseFloat(this.visProp.size) + parseFloat(this.visProp.strokewidth)*0.5;
        if(r < this.board.options.precision.hasPoint) {
            r = this.board.options.precision.hasPoint;
        }

        return ((Math.abs(coordsScr[1]-x) < r+2) && (Math.abs(coordsScr[2]-y)) < r+2);
    },

    /**
    * Dummy function for unconstrained points or gliders.
    * @private
    */
    updateConstraint: function() { return this; },

    /**
     * Updates the position of the point.
     */
    update: function (fromParent) {
        if (!this.needsUpdate) { return this; }

        if(typeof fromParent == 'undefined') {
            fromParent = false;
        }
      
        /*
         * We need to calculate the new coordinates no matter of the points visibility because
         * a child could be visible and depend on the coordinates of the point (e.g. perpendicular).
         * 
         * Check if point is a glider and calculate new coords in dependency of this.slideObject.
         * This function is called with fromParent==true for example if
         * the defining elements of the line or circle have been changed.
         */
        if(this.type == JXG.OBJECT_TYPE_GLIDER) {
            if (fromParent) {
                this.updateGliderFromParent();
            } else {
                this.updateGlider();
            }
        }
        
        /**
        * If point is a calculated point, call updateConstraint() to calculate new coords. 
        * The second test is for dynamic axes.
        */
        if (this.type == JXG.OBJECT_TYPE_CAS || this.type == JXG.OBJECT_TYPE_AXISPOINT) {
            this.updateConstraint();
        }

        this.updateTransform();
        
        if(this.visProp.trace) {
            this.cloneToBackground(true);
        }

        return this;
    },

    /**
    * Update of glider in case of dragging the glider or setting the postion of the glider.
    * The relative position of the glider has to be updated.
    * If the second point is an ideal point, then -1 < this.position < 1,
    * this.position==+/-1 equals point2, this.position==0 equals point1
    * 
    * If the first point is an ideal point, then 0 < this.position < 2
    * this.position==0  or 2 equals point1, this.position==1 equals point2
    * 
    * @private
    */
    updateGlider: function() {
        var i, p1c, p2c, d, v, poly, cc, pos, sgn,
            slide = this.slideObject, alpha, beta, angle;

        if (slide.elementClass == JXG.OBJECT_CLASS_CIRCLE) {
            this.coords  = JXG.Math.Geometry.projectPointToCircle(this, slide, this.board);
            this.position = JXG.Math.Geometry.rad([slide.center.X()+1.0,slide.center.Y()],slide.center,this);
        } else if (slide.elementClass == JXG.OBJECT_CLASS_LINE) {

            /** 
             * onPolygon==true: the point is a slider on a seg,ent and this segment is one of the 
             * "borders" of a polygon.
             * This is a GEONExT feature.
             **/
            if (this.onPolygon) {
                p1c = slide.point1.coords.usrCoords;
                p2c = slide.point2.coords.usrCoords;
                i = 1;
                d = p2c[i] - p1c[i];
                if (Math.abs(d)<JXG.Math.eps) { 
                    i = 2; 
                    d = p2c[i] - p1c[i];
                }
                cc = JXG.Math.Geometry.projectPointToLine(this, slide, this.board);
                pos = (cc.usrCoords[i] - p1c[i]) / d;
                poly = slide.parentPolygon;

                if (pos<0.0) {
                    for (i=0; i<poly.borders.length; i++) {
                        if (slide == poly.borders[i]) {
                            slide = poly.borders[(i - 1 + poly.borders.length) % poly.borders.length];
                            break;
                        }
                    }
                } else if (pos>1.0) {
                    for (i=0; i<poly.borders.length; i++) {
                        if(slide == poly.borders[i]) {
                            slide = poly.borders[(i + 1 + poly.borders.length) % poly.borders.length];
                            break;                        
                        }
                    }
                }
            }

            p1c = slide.point1.coords;
            p2c = slide.point2.coords;
            // Distance between the two defining points
            d = p1c.distance(JXG.COORDS_BY_USER, p2c);
            p1c = p1c.usrCoords.slice(0);
            p2c = p2c.usrCoords.slice(0);
            
            if (d<JXG.Math.eps) {                                        // The defining points are identical
                this.coords.setCoordinates(JXG.COORDS_BY_USER, p1c);
                this.position = 0.0;
            } else {
                this.coords = JXG.Math.Geometry.projectPointToLine(this, slide, this.board);
                if (Math.abs(p2c[0])<JXG.Math.eps) {                 // The second point is an ideal point
                    i = 1;
                    d = p2c[i];
                    if (Math.abs(d)<JXG.Math.eps) { 
                        i = 2; 
                        d = p2c[i];
                    }
                    d = (this.coords.usrCoords[i] - p1c[i]) / d;
                    sgn = (d>=0) ? 1 : -1;
                    d = Math.abs(d);
                    this.position = sgn * d/(d+1);
                } else if (Math.abs(p1c[0])<JXG.Math.eps) {          // The first point is an ideal point
                    i = 1;
                    d = p1c[i];
                    if (Math.abs(d)<JXG.Math.eps) { 
                        i = 2; 
                        d = p1c[i];
                    }
                    d = (this.coords.usrCoords[i] - p2c[i]) / d;
                    if (d<0.0) {
                        this.position = (1 - 2.0*d) / (1.0 - d); // 1.0 - d/(1-d);
                    } else {
                        this.position = 1/(d+1);
                    }
                } else {
                    i = 1;
                    d = p2c[i] - p1c[i];
                    if (Math.abs(d)<JXG.Math.eps) { 
                        i = 2; 
                        d = p2c[i] - p1c[i];
                    }
                    this.position = (this.coords.usrCoords[i] - p1c[i]) / d;
                }
            }        
                
            // Snap the glider point of the slider into its appropiate position
            // First, recalculate the new value of this.position
            // Second, call update(fromParent==true) to make the positioning snappier.
            if (this.visProp.snapwidth>0.0 && Math.abs(this._smax-this._smin)>=JXG.Math.eps) {
                if (this.position<0.0) this.position = 0.0;
                if (this.position>1.0) this.position = 1.0;
                    
                v = this.position*(this._smax-this._smin)+this._smin;
                v = Math.round(v/this.visProp.snapwidth)*this.visProp.snapwidth;
                this.position = (v-this._smin)/(this._smax-this._smin);
                this.update(true);
            }

            p1c = slide.point1.coords.usrCoords;
            if (!slide.visProp.straightfirst && Math.abs(p1c[0])>JXG.Math.eps && this.position<0) {
                this.coords.setCoordinates(JXG.COORDS_BY_USER, p1c);
                this.position = 0;
            }
            p2c = slide.point2.coords.usrCoords;
            if (!slide.visProp.straightlast && Math.abs(p2c[0])>JXG.Math.eps && this.position>1) {
                this.coords.setCoordinates(JXG.COORDS_BY_USER, p2c);
                this.position = 1;
            }
    

        } else if (slide.type == JXG.OBJECT_TYPE_TURTLE) {
            this.updateConstraint(); // In case, the point is a constrained glider.
            this.coords  = JXG.Math.Geometry.projectPointToTurtle(this, slide, this.board);  // side-effect: this.position is overwritten
        } else if(slide.elementClass == JXG.OBJECT_CLASS_CURVE) {
            
            if (slide.type == JXG.OBJECT_TYPE_ARC || slide.type == JXG.OBJECT_TYPE_SECTOR) {
                this.coords  = JXG.Math.Geometry.projectPointToCircle(this, slide, this.board);
                angle = JXG.Math.Geometry.rad(slide.radiuspoint, slide.center, this);
                alpha = 0.0;
                beta = JXG.Math.Geometry.rad(slide.radiuspoint, slide.center, slide.anglepoint);
                this.position = angle;
                
                if ((slide.visProp.type=='minor' && beta>Math.PI)
                    || (slide.visProp.type=='major' && beta<Math.PI)) { 
                    alpha = beta; 
                    beta = 2*Math.PI;
                }      
                        
                if (angle<alpha || angle>beta) {         // Correct the position if we are outside of the sector/arc
                    this.position = beta;
                    if ((angle<alpha && angle>alpha*0.5) || (angle>beta && angle>beta*0.5 + Math.PI)) {
                        this.position = alpha;
                    }
                    this.updateGliderFromParent();
                } 
            } else {
                this.updateConstraint(); // In case, the point is a constrained glider.
                this.coords  = JXG.Math.Geometry.projectPointToCurve(this, slide, this.board);  // side-effect: this.position is overwritten
            }
            
        } else if(slide.elementClass == JXG.OBJECT_CLASS_POINT) {
            this.coords  = JXG.Math.Geometry.projectPointToPoint(this, slide, this.board);
        }
    },

    /**
    * Update of a glider in case a parent element has been updated. That means the 
    * relative position of the glider stays the same.
    * @private
    */
    updateGliderFromParent: function() {
        var p1c, p2c, r, lbda,
            slide = this.slideObject, alpha;

        if(slide.elementClass == JXG.OBJECT_CLASS_CIRCLE) {
			r = slide.Radius();
            this.coords.setCoordinates(JXG.COORDS_BY_USER, [
					slide.center.X() + r*Math.cos(this.position),
					slide.center.Y() + r*Math.sin(this.position)
				]);
        } else if(slide.elementClass == JXG.OBJECT_CLASS_LINE) {
            p1c = slide.point1.coords.usrCoords;
            p2c = slide.point2.coords.usrCoords;
            if (Math.abs(p2c[0])<JXG.Math.eps) {                        // The second point is an ideal point
                lbda = Math.min(Math.abs(this.position), 1.0-JXG.Math.eps);
                lbda /= (1.0-lbda);
                if (this.position < 0) {
                    lbda *= -1.0;
                }
                this.coords.setCoordinates(JXG.COORDS_BY_USER, [
                    p1c[0] + lbda*p2c[0],
                    p1c[1] + lbda*p2c[1],
					p1c[2] + lbda*p2c[2]
                ]);
            } else if (Math.abs(p1c[0])<JXG.Math.eps) {                 // The first point is an ideal point
                lbda = Math.max(this.position, JXG.Math.eps);
                lbda = Math.min(lbda, 2.0-JXG.Math.eps);
                if (lbda > 1.0) {
                    lbda = (lbda-1)/(lbda-2);
                } else {
                    lbda = (1.0-lbda)/lbda;
                }
                this.coords.setCoordinates(JXG.COORDS_BY_USER, [
                    p2c[0] + lbda*p1c[0],
                    p2c[1] + lbda*p1c[1],
					p2c[2] + lbda*p1c[2]
                ]);
            } else {
                lbda = this.position;
                this.coords.setCoordinates(JXG.COORDS_BY_USER, [
                    p1c[0] + lbda*(p2c[0]-p1c[0]),
                    p1c[1] + lbda*(p2c[1]-p1c[1]),
					p1c[2] + lbda*(p2c[2]-p1c[2])
                ]);
            }
        } else if(slide.type == JXG.OBJECT_TYPE_TURTLE) {
            this.coords.setCoordinates(JXG.COORDS_BY_USER, [slide.Z(this.position), slide.X(this.position), slide.Y(this.position)]);
            this.updateConstraint(); // In case, the point is a constrained glider.
            this.coords  = JXG.Math.Geometry.projectPointToTurtle(this, slide, this.board);  // side-effect: this.position is overwritten
        } else if(slide.elementClass == JXG.OBJECT_CLASS_CURVE) {
            this.coords.setCoordinates(JXG.COORDS_BY_USER, [slide.Z(this.position), slide.X(this.position), slide.Y(this.position)]);
            
            if (slide.type == JXG.OBJECT_TYPE_ARC || slide.type == JXG.OBJECT_TYPE_SECTOR) {
                alpha = JXG.Math.Geometry.rad([slide.center.X()+1, slide.center.Y()], slide.center, slide.radiuspoint);
                r = slide.Radius();
                this.coords.setCoordinates(JXG.COORDS_BY_USER, [
                        slide.center.X() + r*Math.cos(this.position+alpha),
                        slide.center.Y() + r*Math.sin(this.position+alpha)
                    ]);
            } else {
                this.updateConstraint(); // In case, the point is a constrained glider.
                this.coords  = JXG.Math.Geometry.projectPointToCurve(this, slide, this.board);  // side-effect: this.position is overwritten
            }
            
        } else if(slide.elementClass == JXG.OBJECT_CLASS_POINT) {
            this.coords  = JXG.Math.Geometry.projectPointToPoint(this, slide, this.board);
        }
    },

    /**
     * Calls the renderer to update the drawing.
     * @private
     */
    updateRenderer: function () {
        if (!this.needsUpdate) { return this; }

        /* Call the renderer only if point is visible. */
        if(this.visProp.visible && this.visProp.size > 0) {
            var wasReal = this.isReal;
            this.isReal = (!isNaN(this.coords.usrCoords[1] + this.coords.usrCoords[2]));
            this.isReal = (Math.abs(this.coords.usrCoords[0])>JXG.Math.eps)?this.isReal:false;  //Homogeneous coords: ideal point
            if (this.isReal) {
                if (wasReal!=this.isReal) { 
                    this.board.renderer.show(this); 
                    if(this.hasLabel && this.label.content.visProp.visible) this.board.renderer.show(this.label.content);
                }
                this.board.renderer.updatePoint(this);
            } else {
                if (wasReal!=this.isReal) { 
                    this.board.renderer.hide(this); 
                    if(this.hasLabel && this.label.content.visProp.visible) this.board.renderer.hide(this.label.content);
                }
            }
        } 

        /* Update the label if visible. */
        if(this.hasLabel && this.visProp.visible && this.label.content && this.label.content.visProp.visible && this.isReal) {
            this.label.content.update();
            this.board.renderer.updateText(this.label.content);
        }
        
        this.needsUpdate = false; 
        return this;
    },

    /**
     * Getter method for x, this is used by for CAS-points to access point coordinates.
     * @return User coordinate of point in x direction.
     * @type Number
     */
    X: function () {
        return this.coords.usrCoords[1];
    },

    /**
     * Getter method for y, this is used by CAS-points to access point coordinates.
     * @return User coordinate of point in y direction.
     * @type Number
     */
    Y: function () {
        return this.coords.usrCoords[2];
    },

    /**
     * Getter method for z, this is used by CAS-points to access point coordinates.
     * @return User coordinate of point in z direction.
     * @type Number
     */
    Z: function () {
        return this.coords.usrCoords[0];
    },

    /**
     * New evaluation of the function term. 
     * This is required for CAS-points: Their XTerm() method is overwritten in {@link #addConstraint}
     * @return User coordinate of point in x direction.
     * @type Number
     * @private
     */
    XEval: function () {
        return this.coords.usrCoords[1];
    },

    /**
     * New evaluation of the function term. 
     * This is required for CAS-points: Their YTerm() method is overwritten in {@link #addConstraint}
     * @return User coordinate of point in y direction.
     * @type Number
     * @private
     */
    YEval: function () {
        return this.coords.usrCoords[2];
    },

    /**
     * New evaluation of the function term. 
     * This is required for CAS-points: Their ZTerm() method is overwritten in {@link #addConstraint}
     * @return User coordinate of point in z direction.
     * @type Number
     * @private
     */
    ZEval: function () {
        return this.coords.usrCoords[0];
    },

    // documented in JXG.GeometryElement
    bounds: function () {
        return this.coords.usrCoords.slice(1).concat(this.coords.usrCoords.slice(1));
    },

    /**
     * Getter method for the distance to a second point, this is required for CAS-elements.
     * Here, function inlining seems to be worthwile  (for plotting).
     * @param {JXG.Point} point2 The point to which the distance shall be calculated.
     * @returns {Number} Distance in user coordinate to the given point
     */
    Dist: function(point2) {
        var sum,
            c = point2.coords.usrCoords,
            ucr = this.coords.usrCoords,
            f;
            
        f = ucr[0]-c[0];
        sum = f*f;
        f = ucr[1]-c[1];
        sum += f*f;
        f = ucr[2]-c[2];
        sum += f*f;
        return Math.sqrt(sum);
    },

    snapToGrid: function () {
        return this.handleSnapToGrid();
    },

    /**
     * Move a point to its nearest grid point.
     * The function uses the coords object of the point as
     * its actual position.
     **/
    handleSnapToGrid: function() {
        var x, y, sX = this.visProp.snapsizex, sY = this.visProp.snapsizey;
        
        if (this.visProp.snaptogrid) {
            x = this.coords.usrCoords[1];
            y = this.coords.usrCoords[2];
            
            if (sX <= 0 && this.board.defaultAxes && this.board.defaultAxes.x.defaultTicks) {
                sX = this.board.defaultAxes.x.defaultTicks.ticksDelta*(this.board.defaultAxes.x.defaultTicks.visProp.minorticks+1);
            }

            if (sY <= 0 && this.board.defaultAxes && this.board.defaultAxes.y.defaultTicks) {
                sY = this.board.defaultAxes.y.defaultTicks.ticksDelta*(this.board.defaultAxes.y.defaultTicks.visProp.minorticks+1);
            }

            // if no valid snap sizes are available, don't change the coords.
            if (sX > 0 && sY > 0) {
                this.coords.setCoordinates(JXG.COORDS_BY_USER, [Math.round(x/sX)*sX, Math.round(y/sY)*sY]);
            }
        }
        return this;
    },
 
    /**
     * Let a point snap to the nearest point in distance of 
     * {@link JXG.Point#attractorDistance}. 
     * The function uses the coords object of the point as
     * its actual position.
     **/
    handleSnapToPoints: function() {
        var el, pEl, pCoords, d=0.0, dMax=Infinity, c=null;
        
        if (this.visProp.snaptopoints) {
            for (el in this.board.objects) {
                pEl = this.board.objects[el];
                if (pEl.elementClass==JXG.OBJECT_CLASS_POINT && pEl!==this && pEl.visProp.visible) {
                    pCoords = JXG.Math.Geometry.projectPointToPoint(this, pEl, this.board); 
                    d = pCoords.distance(JXG.COORDS_BY_USER, this.coords);
                    if (d<this.visProp.attractordistance && d<dMax) {
                        dMax = d;
                        c = pCoords;
                    } 
                }
            }
            if (c!=null) {
                this.coords.setCoordinates(JXG.COORDS_BY_USER, c.usrCoords);
            }
        }

        return this;
    },
     
    /**
     * A point can change its type from free point to glider
     * and vice versa. If it is given an array of attractor elements 
     * (attribute attractors) and the attribute attractorDistance
     * then the pint will be made a glider if it less than attractorDistance
     * apart from one of its attractor elements.
     * If attractorDistance is equal to zero, the point stays in its
     * current form.
     **/
    handleAttractors: function() {
        var len = this.visProp.attractors.length,
            i, el, projCoords, d = 0.0;
            
        if (this.visProp.attractordistance==0.0) {
            return;
        }

        for (i=0; i<len; i++) {
            el = JXG.getRef(this.board, this.visProp.attractors[i]);
            if (!JXG.exists(el) || el===this) {
                continue;
            }
            if (el.elementClass==JXG.OBJECT_CLASS_POINT) {
                projCoords = JXG.Math.Geometry.projectPointToPoint(this, el, this.board);
            } else if (el.elementClass==JXG.OBJECT_CLASS_LINE) {
                projCoords = JXG.Math.Geometry.projectPointToLine(this, el, this.board);
            } else if (el.elementClass==JXG.OBJECT_CLASS_CIRCLE) {
                projCoords = JXG.Math.Geometry.projectPointToCircle(this, el, this.board);
            } else if (el.elementClass==JXG.OBJECT_CLASS_CURVE) {
                projCoords = JXG.Math.Geometry.projectPointToCurve(this, el, this.board);
            } else if (el.type == JXG.OBJECT_TYPE_TURTLE) {
                projCoords = JXG.Math.Geometry.projectPointToTurtle(this, el, this.board);
            }
            d = projCoords.distance(JXG.COORDS_BY_USER, this.coords);
            if (d<this.visProp.attractordistance) {
                found = true;
                if (!(this.type==JXG.OBJECT_TYPE_GLIDER && this.slideObject==el)) {
                    this.makeGlider(el);
                }
                break;
            } else {
                if (el==this.slideObject && d>=this.visProp.snatchdistance) {
                    this.type = JXG.OBJECT_TYPE_POINT;
                }
            }
        }

        return this;
    },
    
    /**
     * Sets coordinates and calls the point's update() method.
     * @param {Number} method The type of coordinates used here. Possible values are {@link JXG.COORDS_BY_USER} and {@link JXG.COORDS_BY_SCREEN}.
     * @param {Array} coords coordinates <tt>(z, x, y)</tt> in screen/user units
     * @returns {JXG.Point}
     */
    setPositionDirectly: function (method, coords) {
        var i, dx, dy, dz, el, p,
            oldCoords = this.coords,
            newCoords;

        this.coords.setCoordinates(method, coords);
        this.handleSnapToGrid();
        this.handleSnapToPoints();
        this.handleAttractors();
        
        if(this.group.length > 0) {
            // Here used to be the udpate of the groups. I'm not sure why we don't need to execute
            // the else branch if there are groups defined on this point, hence I'll let the if live.
        } else {
            // Update the initial coordinates. This is needed for free points
            // that have a transformation bound to it.
            for (i = this.transformations.length - 1; i >= 0; i--) {
                if (method === JXG.COORDS_BY_SCREEN) {
                    newCoords = (new JXG.Coords(method, coords, this.board)).usrCoords;
                } else {
                    if (coords.length === 2) {
                        coords = [1].concat(coords);
                    }
                    newCoords = coords;
                }
                this.initialCoords.setCoordinates(JXG.COORDS_BY_USER, JXG.Math.matVecMult(JXG.Math.inverse(this.transformations[i].matrix), newCoords));
            }
            this.update();
        }

        return this;
    },

    /**
     * Translates the point by <tt>tv = (x, y)</tt>.
     * @param {Number} method The type of coordinates used here. Possible values are {@link JXG.COORDS_BY_USER} and {@link JXG.COORDS_BY_SCREEN}.
     * @param {Number} tv (x, y)
     * @returns {JXG.Point}
     */
    setPositionByTransform: function (method, tv) {
        var t;

        tv = new JXG.Coords(method, tv, this.board);
        t = this.board.create('transform', tv.usrCoords.slice(1), {type:'translate'});

        if (this.transformations.length > 0 && this.transformations[this.transformations.length - 1].isNumericMatrix) {
            this.transformations[this.transformations.length - 1].melt(t);
        } else {
            this.addTransform(this, t);
        }

        //if (this.group.length == 0) {
        this.update();
        //}
        return this;
    },

    /**
     * Sets coordinates and calls the point's update() method.
     * @param {Number} method The type of coordinates used here. Possible values are {@link JXG.COORDS_BY_USER} and {@link JXG.COORDS_BY_SCREEN}.
     * @param {Array} coords coordinates in screen/user units
     * @returns {JXG.Point}
     */
    setPosition: function (method, coords) {
        return this.setPositionDirectly(method, coords);
    },

    /**
     * Sets the position of a glider relative to the defining elements of the {@link JXG.Point#slideObject}.
     * @param {Number} x
     * @returns {JXG.Point} Reference to the point element.
     */
    setGliderPosition: function (x) {
        if (this.type = JXG.OBJECT_TYPE_GLIDER) {
            this.position = x;
            this.board.update();
        }
        
        return this;
    },

    /**
     * Convert the point to glider and update the construction.
     * @param {String|Object} glideObject The Object the point will be bound to.
     */
    makeGlider: function (glideObject) {
        //var c = this.coords.usrCoords.slice(1);
        this.slideObject = JXG.getRef(this.board, glideObject);
        this.type = JXG.OBJECT_TYPE_GLIDER;
        this.elType = 'glider';
        this.visProp.snapwidth = -1;          // By default, deactivate snapWidth
        this.slideObject.addChild(this);
        this.isDraggable = true;

        this.generatePolynomial = function() {
            return this.slideObject.generatePolynomial(this);
        };

        this.updateGlider(); // Determine the initial value of this.position
        //this.moveTo(c);
        //this.prepareUpdate().update().updateRenderer();
        return this;
    },

    /**
     * Converts a glider into a free point.
     */
    free: function () {
        var anc;

        if (this.type !== JXG.OBJECT_TYPE_GLIDER) {
            if (!this.isDraggable) {
                this.isDraggable = true;
                this.type = JXG.OBJECT_TYPE_POINT;

                this.XEval = function () {
                    return this.coords.usrCoords[1];
                };

                this.YEval = function () {
                    return this.coords.usrCoords[2];
                };

                this.ZEval = function () {
                    return this.coords.usrCoords[0];
                };

                this.Xjc = null;
                this.Yjc = null;
            } else {
                return;
            }
        }
/*
		// Deleting the ancestors is a bug!!! (see: http://dev.sketchometry.com/issues/208)

        for (anc in this.ancestors) {
			if (this.ancestors[anc].descendants[this.id])
            	delete this.ancestors[anc].descendants[this.id];

			if (this.ancestors[anc].childElements[this.id])
            	delete this.ancestors[anc].childElements[this.id];
        }
*/
        this.ancestors = []; // only remove the reference

        this.slideObject = null;
        this.elType = 'point';
        this.type = JXG.OBJECT_TYPE_POINT;
    },

    /**
     * Convert the point to CAS point and call update().
     * @param {Array} terms [[zterm], xterm, yterm] defining terms for the z, x and y coordinate.
     * The z-coordinate is optional and it is used for homogeneous coordinates.
     * The coordinates may be either <ul>
     *   <li>a JavaScript function,</li>
     *   <li>a string containing GEONExT syntax. This string will be converted into a JavaScript 
     *     function here,</li>
     *   <li>a Number</li>
     *   <li>a pointer to a slider object. This will be converted into a call of the Value()-method 
     *     of this slider.</li>
     *   </ul>
     * @see JXG.GeonextParser#geonext2JS
     */
    addConstraint: function (terms) {
        this.type = JXG.OBJECT_TYPE_CAS;
        var newfuncs = [],
            fs, i, v, t,
            what = ['X', 'Y'];
        
        this.isDraggable = false;
        for (i=0;i<terms.length;i++) {
            v = terms[i];
            if (typeof v=='string') {
                // Convert GEONExT syntax into  JavaScript syntax
                //t  = JXG.GeonextParser.geonext2JS(v, this.board);
                //newfuncs[i] = new Function('','return ' + t + ';');
                newfuncs[i] = this.board.jc.snippet(v, true, null, true);

                if (terms.length === 2) {
                    this[what[i] + 'jc'] = terms[i];
                }
            } else if (typeof v=='function') {
                newfuncs[i] = v;
            } else if (typeof v=='number') {
                newfuncs[i] = function(z){ return function() { return z; }; }(v);
            } else if (typeof v == 'object' && typeof v.Value == 'function') {    // Slider
                newfuncs[i] = (function(a) { return function() { return a.Value(); };})(v);
            }

            newfuncs[i].origin = v;
        }
        if (terms.length==1) { // Intersection function
            this.updateConstraint = function() { 
                    var c = newfuncs[0](); 
                    if (JXG.isArray(c)) {      // Array
                        this.coords.setCoordinates(JXG.COORDS_BY_USER,c);
                    } else {                   // Coords object
                        this.coords = c;
                    }
                };
        } else if (terms.length==2) { // Euclidean coordinates
            this.XEval = newfuncs[0];
            this.YEval = newfuncs[1];
            fs = 'this.coords.setCoordinates(' + JXG.COORDS_BY_USER + ',[this.XEval(),this.YEval()]);';
            this.updateConstraint = new Function('',fs);
        } else { // Homogeneous coordinates
            this.ZEval = newfuncs[0];
            this.XEval = newfuncs[1];
            this.YEval = newfuncs[2];
            fs = 'this.coords.setCoordinates(' + JXG.COORDS_BY_USER + ',[this.ZEval(),this.XEval(),this.YEval()]);';
            this.updateConstraint = new Function('',fs);
        }

        if (!this.board.isSuspendedUpdate) { this.prepareUpdate().update().updateRenderer(); }
        return this;
    },

    /**
     * Applies the transformations of the curve to {@link JXG.Point#baseElement}.
     * @returns {JXG.Point} Reference to this point object.
     */
    updateTransform: function () {
        if (this.transformations.length==0 || this.baseElement==null) {
            return this;
        }
        var c, i;

        if (this===this.baseElement) {      // case of bindTo
            c = this.transformations[0].apply(this.baseElement, 'self');
        } else {                           // case of board.create('point',[baseElement,transform]);
            c = this.transformations[0].apply(this.baseElement);
        }
        this.coords.setCoordinates(JXG.COORDS_BY_USER,c);
        for (i = 1; i < this.transformations.length; i++) {
            this.coords.setCoordinates(JXG.COORDS_BY_USER, this.transformations[i].apply(this));
        }
        return this;
    },

    /**
     * Add transformations to this point.
     * @param {JXG.GeometryElement} el TODO base element
     * @param {JXG.Transform|Array} transform Either one {@link JXG.Transform} or an array of {@link JXG.Transform}s.
     * @returns {JXG.Point} Reference to this point object.
     */
    addTransform: function (el, transform) {
        var i,
            list = JXG.isArray(transform) ? transform : [transform],
            len = list.length;

        if (this.transformations.length === 0) { // There is only one baseElement possible
            this.baseElement = el;
        }

        for (i = 0; i < len; i++) {
            this.transformations.push(list[i]);
        }
        return this;
    },

    /**
     * Animate the point. 
     * @param {Number} direction The direction the glider is animated. Can be +1 or -1.
     * @param {Number} stepCount The number of steps.
     * @name Glider#startAnimation
     * @see Glider#stopAnimation
     * @function
     */
    startAnimation: function(direction, stepCount) {
        if((this.type == JXG.OBJECT_TYPE_GLIDER) && (typeof this.intervalCode == 'undefined')) {
            this.intervalCode = window.setInterval('JXG.JSXGraph.boards[\'' + this.board.id + '\'].objects[\'' + this.id + '\']._anim(' 
                                                    + direction + ', ' + stepCount + ')', 250);
            if(typeof this.intervalCount == 'undefined')
                this.intervalCount = 0;
        }
        return this;
    },

    /**
     * Stop animation.
     * @name Glider#stopAnimation
     * @see Glider#startAnimation
     * @function
     */
    stopAnimation: function() {
        if(typeof this.intervalCode != 'undefined') {
            window.clearInterval(this.intervalCode);
            delete(this.intervalCode);
        }
        return this;
    },

    /**
     * Starts an animation which moves the point along a given path in given time.
     * @param {Array,function} path The path the point is moved on. This can be either an array of arrays containing x and y values of the points of
     * the path, or  function taking the amount of elapsed time since the animation has started and returns an array containing a x and a y value or NaN.
     * In case of NaN the animation stops.
     * @param {Number} time The time in milliseconds in which to finish the animation
     * @param {Object} [options] Optional settings for the animation:<ul><li>callback: A function that is called as soon as the animation is finished.</li></ul>
     * @returns {JXG.Point} Reference to the point.
     */
    moveAlong: function(path, time, options) {
        options = options || {};
        var interpath = [],
            delay = this.board.options.animationDelay,
            makeFakeFunction = function (i, j) {
                return function() {
                    return path[i][j];
                };
            },
            p = [], i, neville,
            steps = time/delay;

        if (JXG.isArray(path)) {
            for (i = 0; i < path.length; i++) {
                if (JXG.isPoint(path[i])) {
                    p[i] = path[i];
                } else {
                    p[i] = {
                        elementClass: JXG.OBJECT_CLASS_POINT,
                        X: makeFakeFunction(i, 0),
                        Y: makeFakeFunction(i, 1)
                    };
                }
            }

            time = time || 0;
            if (time === 0) {
                this.setPosition(JXG.COORDS_BY_USER, [p[p.length - 1].X(), p[p.length - 1].Y()]);
                return this.board.update(this);
            }

            neville = JXG.Math.Numerics.Neville(p);
            for (i = 0; i < steps; i++) {
                interpath[i] = [];
                interpath[i][0] = neville[0]((steps - i) / steps * neville[3]());
                interpath[i][1] = neville[1]((steps - i) / steps * neville[3]());
            }

            this.animationPath = interpath;
        } else if (JXG.isFunction(path)) {
            this.animationPath = path;
            this.animationStart = new Date().getTime();
        }
        this.animationCallback = options.callback;

        this.board.addAnimation(this);
        return this;
    },

    /**
     * Starts an animated point movement towards the given coordinates <tt>where</tt>. The animation is done after <tt>time</tt> milliseconds.
     * If the second parameter is not given or is equal to 0, setPosition() is called, see #setPosition.
     * @param {Array} where Array containing the x and y coordinate of the target location.
     * @param {Number} [time] Number of milliseconds the animation should last.
     * @param {Object} [options] Optional settings for the animation:<ul><li>callback: A function that is called as soon as the animation is finished.</li>
     * <li>effect: animation effects like speed fade in and out. possible values are '<>' for speed increase on start and slow down at the end (default)
     * and '--' for constant speed during the whole animation.</li></ul>
     * @returns {JXG.Point} Reference to itself.
     * @see #animate
     */
    moveTo: function(where, time, options) {
        where = new JXG.Coords(JXG.COORDS_BY_USER, where, this.board);

        if (typeof time == 'undefined' || time == 0 || (Math.abs(where.usrCoords[0] - this.coords.usrCoords[0]) > JXG.Math.eps)) {
            this.setPosition(JXG.COORDS_BY_USER, where.usrCoords);
            return this.board.update(this);
        }

        options = options || {};
        
    	var delay = this.board.options.animationDelay,
    	    steps = Math.ceil(time/(delay * 1.0)),
    		coords = new Array(steps+1),
    		X = this.coords.usrCoords[1],
    		Y = this.coords.usrCoords[2],
    		dX = (where.usrCoords[1] - X),
    		dY = (where.usrCoords[2] - Y),
    	    i,
            stepFun = function (i) {
                if (options.effect && options.effect == '<>') {
                    return Math.pow(Math.sin((i/(steps*1.0))*Math.PI/2.), 2);
                }
                return i/steps;
            };

        if(Math.abs(dX) < JXG.Math.eps && Math.abs(dY) < JXG.Math.eps) {
            return this;
        }

    	for(i=steps; i>=0; i--) {
    		coords[steps-i] = [where.usrCoords[0], X + dX * stepFun(i), Y+ dY * stepFun(i)];
    	}

    	this.animationPath = coords;
        this.animationCallback = options.callback;
        this.board.addAnimation(this);
        return this;
    },

    /**
     * Starts an animated point movement towards the given coordinates <tt>where</tt>. After arriving at <tt>where</tt> the point moves back to where it started.
     * The animation is done after <tt>time</tt> milliseconds.
     * @param {Array} where Array containing the x and y coordinate of the target location.
     * @param {Number} time Number of milliseconds the animation should last.
     * @param {Object} [options] Optional settings for the animation:<ul><li>callback: A function that is called as soon as the animation is finished.</li>
     * <li>effect: animation effects like speed fade in and out. possible values are '<>' for speed increase on start and slow down at the end (default)
     * and '--' for constant speed during the whole animation.</li><li>repeat: How often this animation should be repeated (default: 1)</li></ul>
     * @returns {JXG.Point} Reference to itself.
     * @see #animate
     */
    visit: function(where, time, options) {
        // support legacy interface where the third parameter was the number of repeats
        if (typeof options == 'number') {
            options = {repeat: options};
        } else {
            options = options || {};
            if(typeof options.repeat == 'undefined')
                options.repeat = 1;
        }

        var delay = this.board.options.animationDelay,
            steps = Math.ceil(time/(delay*options.repeat)),
            coords = new Array(options.repeat*(steps+1)),
            X = this.coords.usrCoords[1],
            Y = this.coords.usrCoords[2],
            dX = (where[0] - X),
            dY = (where[1] - Y),
            i, j,
            stepFun = function (i) {
                var x = (i < steps/2 ? 2*i/steps : 2*(steps-i)/steps);
                if (options.effect && options.effect == '<>') {
                    return Math.pow(Math.sin((x)*Math.PI/2.), 2);
                }
                return x;
            };

        for (j = 0; j < options.repeat; j++) {
            for(i = steps; i >= 0; i--) {
                coords[j*(steps+1) + steps-i] = [where[0], X + dX * stepFun(i), Y+ dY * stepFun(i)];
            }
        }
        this.animationPath = coords;
        this.animationCallback = options.callback;
        this.board.addAnimation(this);
        return this;
    },

    /**
     * Animates a glider. Is called by the browser after startAnimation is called.
     * @param {Number} direction The direction the glider is animated.
     * @param {Number} stepCount The number of steps.
     * @see #startAnimation
     * @see #stopAnimation
     * @private
     */
    _anim: function(direction, stepCount) {
        var distance, slope, dX, dY, alpha, startPoint,
            factor = 1, newX, radius;
        
        this.intervalCount++;
        if(this.intervalCount > stepCount)
            this.intervalCount = 0;
        
        if(this.slideObject.elementClass == JXG.OBJECT_CLASS_LINE) {
            distance = this.slideObject.point1.coords.distance(JXG.COORDS_BY_SCREEN, this.slideObject.point2.coords);
            slope = this.slideObject.getSlope();
            if(slope != 'INF') {
                alpha = Math.atan(slope);
                dX = Math.round((this.intervalCount/stepCount) * distance*Math.cos(alpha));
                dY = Math.round((this.intervalCount/stepCount) * distance*Math.sin(alpha));
            } else {
                dX = 0;
                dY = Math.round((this.intervalCount/stepCount) * distance);
            }
            
            if(direction < 0) {
                startPoint = this.slideObject.point2;
                if(this.slideObject.point2.coords.scrCoords[1] - this.slideObject.point1.coords.scrCoords[1] > 0)
                    factor = -1;
                else if(this.slideObject.point2.coords.scrCoords[1] - this.slideObject.point1.coords.scrCoords[1] == 0) {
                    if(this.slideObject.point2.coords.scrCoords[2] - this.slideObject.point1.coords.scrCoords[2] > 0)
                        factor = -1;
                }
            } else {
                startPoint = this.slideObject.point1;
                if(this.slideObject.point1.coords.scrCoords[1] - this.slideObject.point2.coords.scrCoords[1] > 0)
                    factor = -1;
                else if(this.slideObject.point1.coords.scrCoords[1] - this.slideObject.point2.coords.scrCoords[1] == 0) {
                    if(this.slideObject.point1.coords.scrCoords[2] - this.slideObject.point2.coords.scrCoords[2] > 0)
                        factor = -1;
                }
            }
            
            this.coords.setCoordinates(JXG.COORDS_BY_SCREEN, [startPoint.coords.scrCoords[1] + factor*dX, 
                                                              startPoint.coords.scrCoords[2] + factor*dY]);
        } else if(this.slideObject.elementClass == JXG.OBJECT_CLASS_CURVE) {
            if(direction > 0) {
                newX = Math.round(this.intervalCount/stepCount * this.board.canvasWidth);
            } else {
                newX = Math.round((stepCount - this.intervalCount)/stepCount * this.board.canvasWidth);
            }
      
            this.coords.setCoordinates(JXG.COORDS_BY_SCREEN, [newX, 0]);
            this.coords = JXG.Math.Geometry.projectPointToCurve(this, this.slideObject, this.board);
        } else if(this.slideObject.elementClass == JXG.OBJECT_CLASS_CIRCLE) {
            if(direction < 0) {
                alpha = this.intervalCount/stepCount * 2*Math.PI;
            } else {
                alpha = (stepCount - this.intervalCount)/stepCount * 2*Math.PI;
            }

            radius = this.slideObject.Radius();

            this.coords.setCoordinates(JXG.COORDS_BY_USER, [this.slideObject.center.coords.usrCoords[1] + radius*Math.cos(alpha),
                                                            this.slideObject.center.coords.usrCoords[2] + radius*Math.sin(alpha)]);
        }
        
        this.board.update(this);
        return this;
    },

    /**
     * Set the style of a point. Used for GEONExT import and should not be used to set the point's face and size.
     * @param {Number} i Integer to determine the style.
     * @private
     */
    setStyle: function(i) {
        var facemap = [
                // 0-2
                'cross', 'cross', 'cross',
                // 3-6
                'circle', 'circle', 'circle', 'circle',
                // 7-9
                'square', 'square', 'square',
                // 10-12
                'plus', 'plus', 'plus'
            ], sizemap = [
                // 0-2
                2, 3, 4,
                // 3-6
                1, 2, 3, 4,
                // 7-9
                2, 3, 4,
                // 10-12
                2, 3, 4
            ];

        this.visProp.face = facemap[i];
        this.visProp.size = sizemap[i];

        this.board.renderer.changePointStyle(this);
        return this;
    },

    /**
     * All point faces can be defined with more than one name, e.g. a cross faced point can be given
     * by face equal to 'cross' or equal to 'x'. This method maps all possible values to fixed ones to
     * simplify if- and switch-clauses regarding point faces. The translation table is as follows:
     * <table>
     * <tr><th>Input</th><th>Output</th></tr>
     * <tr><td>cross, x</td><td>x</td></tr>
     * <tr><td>circle, o</td><td>o</td></tr>
     * <tr><td>square, []</td><td>[]</td></tr>
     * <tr><td>plus, +</td><td>+</td></tr>
     * <tr><td>diamond, &lt;&gt;</td><td>&lt;&gt;</td></tr>
     * <tr><td>triangleup, a, ^</td><td>A</td></tr>
     * <tr><td>triangledown, v</td><td>v</td></tr>
     * <tr><td>triangleleft, &lt;</td><td>&lt;</td></tr>
     * <tr><td>triangleright, &gt;</td><td>&gt;</td></tr>
     * </table>
     * @param {String} s A string which should determine a valid point face.
     * @returns {String} Returns a normalized string or undefined if the given string is not a valid
     * point face.
     */
    normalizeFace: function(s) {
        var map = {
                cross: 'x',
                x: 'x',
                circle: 'o',
                o: 'o',
                square: '[]',
                '[]': '[]',
                plus: '+',
                '+': '+',
                diamond: '<>',
                '<>': '<>',
                triangleup: '^',
                a: '^',
                '^': '^',
                triangledown: 'v',
                v: 'v',
                triangleleft: '<',
                '<': '<',
                triangleright: '>',
                '>': '>'
            };

        return map[s];
    },

    /**
     * Remove the point from the drawing. This only removes the SVG or VML node of the point and its label from the renderer, to remove
     * the object completely you should use {@link JXG.Board#removeObject}.
     */
    remove: function() {    
        if (this.hasLabel) {
            this.board.renderer.remove(this.board.renderer.getElementById(this.label.content.id));
        }
        this.board.renderer.remove(this.board.renderer.getElementById(this.id));
    },

    // documented in GeometryElement
    getTextAnchor: function() {
        return this.coords;
    },

    // documented in GeometryElement
    getLabelAnchor: function() {
        return this.coords;
    },

    /**
     * Set the face of a point element.
     * @param {string} f String which determines the face of the point. See {@link JXG.GeometryElement#face} for a list of available faces.
     * @see JXG.GeometryElement#face
     */
    face: function(f) {
        this.setProperty({face:f});
    },

    /**
     * Set the size of a point element
     * @param {int} s Integer which determines the size of the point.
     * @see JXG.GeometryElement#size
     */
    size: function(s) {
        this.setProperty({size:s});
    },

    // already documented in GeometryElement
    cloneToBackground: function() {
        var copy = {};

        copy.id = this.id + 'T' + this.numTraces;
        this.numTraces++;

        copy.coords = this.coords;
        copy.visProp = JXG.deepCopy(this.visProp, this.visProp.traceattributes, true);
        copy.visProp.layer = this.board.options.layer.trace;
        copy.elementClass = JXG.OBJECT_CLASS_POINT;
        copy.board = this.board;
        JXG.clearVisPropOld(copy);
        
        this.board.renderer.drawPoint(copy);
        this.traces[copy.id] = copy.rendNode;
        
        return this;
    },

    getParents: function () {
        var p = [this.Z(), this.X(), this.Y()];

        if (this.parents) {
            p = this.parents;
        }

        if (this.type == JXG.OBJECT_TYPE_GLIDER) {
            p = [this.X(), this.Y(), this.slideObject.id];

        }

        return p;
    }
});


/**
 * @class This element is used to provide a constructor for a general point. A free point is created if the given parent elements are all numbers
 * and the property fixed is not set or set to false. If one or more parent elements is not a number but a string containing a GEONE<sub>x</sub>T
 * constraint or a function the point will be considered as constrained). That means that the user won't be able to change the point's
 * position directly.
 * @pseudo
 * @description
 * @name Point
 * @augments JXG.Point
 * @constructor
 * @type JXG.Point
 * @throws {Exception} If the element cannot be constructed with the given parent objects an exception is thrown.
 * @param {Number,string,function_Number,string,function_Number,string,function} z_,x,y Parent elements can be two or three elements of type number, a string containing a GEONE<sub>x</sub>T
 * constraint, or a function which takes no parameter and returns a number. Every parent element determines one coordinate. If a coordinate is
 * given by a number, the number determines the initial position of a free point. If given by a string or a function that coordinate will be constrained
 * that means the user won't be able to change the point's position directly by mouse because it will be calculated automatically depending on the string
 * or the function's return value. If two parent elements are given the coordinates will be interpreted as 2D affine euclidean coordinates, if three such
 * parent elements are given they will be interpreted as homogeneous coordinates.
 * @param {JXG.Point_JXG.Transformation} Point,Transformation A point can also be created providing a transformation. The resulting point is a clone of the base
 * point transformed by the given Transformation. {@see JXG.Transformation}.
 * @example
 * // Create a free point using affine euclidean coordinates 
 * var p1 = board.create('point', [3.5, 2.0]);
 * </pre><div id="672f1764-7dfa-4abc-a2c6-81fbbf83e44b" style="width: 200px; height: 200px;"></div>
 * <script type="text/javascript">
 *   var board = JXG.JSXGraph.initBoard('672f1764-7dfa-4abc-a2c6-81fbbf83e44b', {boundingbox: [-1, 5, 5, -1], axis: true, showcopyright: false, shownavigation: false});
 *   var p1 = board.create('point', [3.5, 2.0]);
 * </script><pre>
 * @example
 * // Create a constrained point using anonymous function 
 * var p2 = board.create('point', [3.5, function () { return p1.X(); }]);
 * </pre><div id="4fd4410c-3383-4e80-b1bb-961f5eeef224" style="width: 200px; height: 200px;"></div>
 * <script type="text/javascript">
 *   var fpex1_board = JXG.JSXGraph.initBoard('4fd4410c-3383-4e80-b1bb-961f5eeef224', {boundingbox: [-1, 5, 5, -1], axis: true, showcopyright: false, shownavigation: false});
 *   var fpex1_p1 = fpex1_board.create('point', [3.5, 2.0]);
 *   var fpex1_p2 = fpex1_board.create('point', [3.5, function () { return fpex1_p1.X(); }]);
 * </script><pre>
 * @example
 * // Create a point using transformations 
 * var trans = board.create('transform', [2, 0.5], {type:'scale'});
 * var p3 = board.create('point', [p2, trans]);
 * </pre><div id="630afdf3-0a64-46e0-8a44-f51bd197bb8d" style="width: 400px; height: 400px;"></div>
 * <script type="text/javascript">
 *   var fpex2_board = JXG.JSXGraph.initBoard('630afdf3-0a64-46e0-8a44-f51bd197bb8d', {boundingbox: [-1, 9, 9, -1], axis: true, showcopyright: false, shownavigation: false});
 *   var fpex2_trans = fpex2_board.create('transform', [2, 0.5], {type:'scale'});
 *   var fpex2_p2 = fpex2_board.create('point', [3.5, 2.0]);
 *   var fpex2_p3 = fpex2_board.create('point', [fpex2_p2, fpex2_trans]);
 * </script><pre>
 */
JXG.createPoint = function(board, parents, attributes) {
    var el, isConstrained = false, i, attr;

    attr = JXG.copyAttributes(attributes, board.options, 'point');

    for (i=0;i<parents.length;i++) {
        if (typeof parents[i]=='function' || typeof parents[i]=='string') {
            isConstrained = true;
        }
    }
    if (!isConstrained) {
        if ( (JXG.isNumber(parents[0])) && (JXG.isNumber(parents[1])) ) {
            el = new JXG.Point(board, parents, attr);
            if ( JXG.exists(attr["slideobject"]) ) {
                el.makeGlider(attr["slideobject"]);
            } else {
                el.baseElement = el; // Free point
            }
            el.isDraggable = true;
        } else if ( (typeof parents[0]=='object') && (typeof parents[1]=='object') ) { // Transformation
            el = new JXG.Point(board, [0,0], attr);
            el.addTransform(parents[0], parents[1]);
            el.isDraggable = false;

            //el.parents = [parents[0].id, parents[1].id];
            el.parents = [parents[0].id];
        }
        else {// Failure
            throw new Error("JSXGraph: Can't create point with parent types '" + 
                            (typeof parents[0]) + "' and '" + (typeof parents[1]) + "'." +
                            "\nPossible parent types: [x,y], [z,x,y], [point,transformation]");
        }

    } else {
        el = new JXG.Point(board, [NaN, NaN], attr);
        el.addConstraint(parents);
    }

    return el;
};

/**
 * @class This element is used to provide a constructor for a glider point. 
 * @pseudo
 * @description A glider is a point which lives on another geometric element like a line, circle, curve, turtle.
 * @name Glider
 * @augments JXG.Point
 * @constructor
 * @type JXG.Point
 * @throws {Exception} If the element cannot be constructed with the given parent objects an exception is thrown.
 * @param {Number_Number_Number_JXG.GeometryElement} z_,x_,y_,GlideObject Parent elements can be two or three elements of type number and the object the glider lives on.
 * The coordinates are completely optional. If not given the origin is used. If you provide two numbers for coordinates they will be interpreted as affine euclidean
 * coordinates, otherwise they will be interpreted as homogeneous coordinates. In any case the point will be projected on the glide object.
 * @example
 * // Create a glider with user defined coordinates. If the coordinates are not on
 * // the circle (like in this case) the point will be projected onto the circle.
 * var p1 = board.create('point', [2.0, 2.0]);
 * var c1 = board.create('circle', [p1, 2.0]);
 * var p2 = board.create('glider', [2.0, 1.5, c1]);
 * </pre><div id="4f65f32f-e50a-4b50-9b7c-f6ec41652930" style="width: 300px; height: 300px;"></div>
 * <script type="text/javascript">
 *   var gpex1_board = JXG.JSXGraph.initBoard('4f65f32f-e50a-4b50-9b7c-f6ec41652930', {boundingbox: [-1, 5, 5, -1], axis: true, showcopyright: false, shownavigation: false});
 *   var gpex1_p1 = gpex1_board.create('point', [2.0, 2.0]);
 *   var gpex1_c1 = gpex1_board.create('circle', [gpex1_p1, 2.0]);
 *   var gpex1_p2 = gpex1_board.create('glider', [2.0, 1.5, gpex1_c1]);
 * </script><pre>
 * @example
 * // Create a glider with default coordinates (1,0,0). Same premises as above.
 * var p1 = board.create('point', [2.0, 2.0]);
 * var c1 = board.create('circle', [p1, 2.0]);
 * var p2 = board.create('glider', [c1]);
 * </pre><div id="4de7f181-631a-44b1-a12f-bc4d995609e8" style="width: 200px; height: 200px;"></div>
 * <script type="text/javascript">
 *   var gpex2_board = JXG.JSXGraph.initBoard('4de7f181-631a-44b1-a12f-bc4d995609e8', {boundingbox: [-1, 5, 5, -1], axis: true, showcopyright: false, shownavigation: false});
 *   var gpex2_p1 = gpex2_board.create('point', [2.0, 2.0]);
 *   var gpex2_c1 = gpex2_board.create('circle', [gpex2_p1, 2.0]);
 *   var gpex2_p2 = gpex2_board.create('glider', [gpex2_c1]);
 * </script><pre>
 */
JXG.createGlider = function(board, parents, attributes) {
    var el, 
        attr = JXG.copyAttributes(attributes, board.options, 'glider');
        
    if (parents.length === 1) {
        el = board.create('point', [0, 0], attr);
    } else {
        el = board.create('point', parents.slice(0, 2), attr);
    }

    // eltype is set in here
    el.makeGlider(parents[parents.length-1]);

    return el;
};

/**
 * @class This element is used to provide a constructor for an intersection point. 
 * @pseudo
 * @description An intersection point is a point which lives on two Lines or Circles or one Line and one Circle at the same time, i.e.
 * an intersection point of the two elements.
 * @name Intersection
 * @augments JXG.Point
 * @constructor
 * @type JXG.Point
 * @throws {Exception} If the element cannot be constructed with the given parent objects an exception is thrown.
 * @param {JXG.Line,JXG.Circle_JXG.Line,JXG.Circle_Number} el1,el2,i The result will be a intersection point on el1 and el2. i determines the
 * intersection point if two points are available: <ul>
 *   <li>i==0: use the positive square root,</li> 
 *   <li>i==1: use the negative square root.</li></ul>
 * @example
 * // Create an intersection point of circle and line
 * var p1 = board.create('point', [2.0, 2.0]);
 * var c1 = board.create('circle', [p1, 2.0]);
 * 
 * var p2 = board.create('point', [2.0, 2.0]);
 * var p3 = board.create('point', [2.0, 2.0]);
 * var l1 = board.create('line', [p2, p3]);
 * 
 * var i = board.create('intersection', [c1, l1, 0]);
 * </pre><div id="e5b0e190-5200-4bc3-b995-b6cc53dc5dc0" style="width: 300px; height: 300px;"></div>
 * <script type="text/javascript">
 *   var ipex1_board = JXG.JSXGraph.initBoard('e5b0e190-5200-4bc3-b995-b6cc53dc5dc0', {boundingbox: [-1, 7, 7, -1], axis: true, showcopyright: false, shownavigation: false});
 *   var ipex1_p1 = ipex1_board.create('point', [4.0, 4.0]);
 *   var ipex1_c1 = ipex1_board.create('circle', [ipex1_p1, 2.0]);
 *   var ipex1_p2 = ipex1_board.create('point', [1.0, 1.0]);
 *   var ipex1_p3 = ipex1_board.create('point', [5.0, 3.0]);
 *   var ipex1_l1 = ipex1_board.create('line', [ipex1_p2, ipex1_p3]);
 *   var ipex1_i = ipex1_board.create('intersection', [ipex1_c1, ipex1_l1, 0]);
 * </script><pre>
 */
JXG.createIntersectionPoint = function(board, parents, attributes) {
    var el,
        attr = JXG.copyAttributes(attributes, board.options, 'intersection'),
        func;


    // make sure we definitely have the indices
    parents.push(0, 0);
    
    el = board.create('point', [0,0,0], attr);
    func = new board.intersection(parents[0], parents[1], parents[2], parents[3], {point:el});
    el.addConstraint([func]);
    
    try {
        parents[0].addChild(el);
        parents[1].addChild(el);
    } catch (e) {
        throw new Error("JSXGraph: Can't create 'intersection' with parent types '" +
                                (typeof parents[0]) + "' and '" + (typeof parents[1])+ "'.");
    }

    el.elType = 'intersection';
    el.parents = [parents[0].id, parents[1].id, parents[2]];

    if (parents[3] != null) {
        el.parents.push(parents[3]);
    }

    el.generatePolynomial = function () {
        var poly1 = parents[0].generatePolynomial(el);
        var poly2 = parents[1].generatePolynomial(el);

        if((poly1.length == 0) || (poly2.length == 0))
            return [];
        else
            return [poly1[0], poly2[0]];
    };
    
    return el;
};

/**
 * @class This element is used to provide a constructor for the "other" intersection point.
 * @pseudo
 * @description An intersection point is a point which lives on two Lines or Circles or one Line and one Circle at the same time, i.e.
 * an intersection point of the two elements. Additionally, one intersection point is provided. The function returns the other intersection point.
 * @name OtherIntersection
 * @augments JXG.Point
 * @constructor
 * @type JXG.Point
 * @throws {Exception} If the element cannot be constructed with the given parent objects an exception is thrown.
 * @param {JXG.Line,JXG.Circle_JXG.Line,JXG.Circle_JXG.Point} el1,el2,p The result will be a intersection point on el1 and el2. i determines the
 * intersection point different from p: 
 * @example
 * // Create an intersection point of circle and line
 * var p1 = board.create('point', [2.0, 2.0]);
 * var c1 = board.create('circle', [p1, 2.0]);
 * 
 * var p2 = board.create('point', [2.0, 2.0]);
 * var p3 = board.create('point', [2.0, 2.0]);
 * var l1 = board.create('line', [p2, p3]);
 * 
 * var i = board.create('intersection', [c1, l1, 0]);
 * var j = board.create('otherintersection', [c1, l1, i]);
 * </pre><div id="45e25f12-a1de-4257-a466-27a2ae73614c" style="width: 300px; height: 300px;"></div>
 * <script type="text/javascript">
 *   var ipex2_board = JXG.JSXGraph.initBoard('45e25f12-a1de-4257-a466-27a2ae73614c', {boundingbox: [-1, 7, 7, -1], axis: true, showcopyright: false, shownavigation: false});
 *   var ipex2_p1 = ipex2_board.create('point', [4.0, 4.0]);
 *   var ipex2_c1 = ipex2_board.create('circle', [ipex2_p1, 2.0]);
 *   var ipex2_p2 = ipex2_board.create('point', [1.0, 1.0]);
 *   var ipex2_p3 = ipex2_board.create('point', [5.0, 3.0]);
 *   var ipex2_l1 = ipex2_board.create('line', [ipex2_p2, ipex2_p3]);
 *   var ipex2_i = ipex2_board.create('intersection', [ipex2_c1, ipex2_l1, 0], {name:'D'});
 *   var ipex2_j = ipex2_board.create('otherintersection', [ipex2_c1, ipex2_l1, ipex2_i], {name:'E'});
 * </script><pre>
 */
JXG.createOtherIntersectionPoint = function(board, parents, attributes) {
    var el;
    if (parents.length!=3 
        || !JXG.isPoint(parents[2]) 
        || (parents[0].elementClass != JXG.OBJECT_CLASS_LINE && parents[0].elementClass != JXG.OBJECT_CLASS_CIRCLE)
        || (parents[1].elementClass != JXG.OBJECT_CLASS_LINE && parents[1].elementClass != JXG.OBJECT_CLASS_CIRCLE) ) {
        // Failure
        throw new Error("JSXGraph: Can't create 'other intersection point' with parent types '" + 
                        (typeof parents[0]) + "',  '" + (typeof parents[1])+ "'and  '" + (typeof parents[2]) + "'." +
                        "\nPossible parent types: [circle|line,circle|line,point]");
    }
    else {
        el = board.create('point', [board.otherIntersection(parents[0], parents[1], parents[2])], attributes);
    }
    el.elType = 'otherintersection';
    el.parents = [parents[0].id, parents[1].id, parents[2]];
    
    parents[0].addChild(el);
    parents[1].addChild(el);

    el.generatePolynomial = function () {
        var poly1 = parents[0].generatePolynomial(el);
        var poly2 = parents[1].generatePolynomial(el);

        if((poly1.length == 0) || (poly2.length == 0))
            return [];
        else
            return [poly1[0], poly2[0]];
    };
    
    return el;
};


JXG.JSXGraph.registerElement('point',JXG.createPoint);
JXG.JSXGraph.registerElement('glider', JXG.createGlider);
JXG.JSXGraph.registerElement('intersection', JXG.createIntersectionPoint);
JXG.JSXGraph.registerElement('otherintersection', JXG.createOtherIntersectionPoint);
