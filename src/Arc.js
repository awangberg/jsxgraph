﻿/*
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
 * @fileoverview In this file the geometry object Arc is defined. Arc stores all
 * style and functional properties that are required to draw an arc on a board.
 */

/**
 * @class An arc is a segment of the circumference of a circle. It is defined by a center, one point that
 * defines the radius, and a third point that defines the angle of the arc.
 * @pseudo
 * @name Arc
 * @augments Curve
 * @constructor
 * @type JXG.Curve
 * @throws {Error} If the element cannot be constructed with the given parent objects an exception is thrown.
 * @param {JXG.Point_JXG.Point_JXG.Point} p1,p2,p3 The result will be an arc of a circle around p1 through p2. The arc is drawn
 * counter-clockwise from p2 to p3.
 * @example
 * // Create an arc out of three free points
 * var p1 = board.create('point', [2.0, 2.0]);
 * var p2 = board.create('point', [1.0, 0.5]);
 * var p3 = board.create('point', [3.5, 1.0]);
 *
 * var a = board.create('arc', [p1, p2, p3]);
 * </pre><div id="114ef584-4a5e-4686-8392-c97501befb5b" style="width: 300px; height: 300px;"></div>
 * <script type="text/javascript">
 * (function () {
 *   var board = JXG.JSXGraph.initBoard('114ef584-4a5e-4686-8392-c97501befb5b', {boundingbox: [-1, 7, 7, -1], axis: true, showcopyright: false, shownavigation: false}),
 *       p1 = board.create('point', [2.0, 2.0]),
 *       p2 = board.create('point', [1.0, 0.5]),
 *       p3 = board.create('point', [3.5, 1.0]),
 *
 *       a = board.create('arc', [p1, p2, p3]);
 * })();
 * </script><pre>
 */
JXG.createArc = function(board, parents, attributes) {
    var el, attr, i;


    // this method is used to create circumccirclearcs, too. if a circumcirclearc is created we get a fourth
    // point, that's why we need to check that case, too.
    if(!(parents = JXG.checkParents('arc', parents, [
            [JXG.OBJECT_CLASS_POINT, JXG.OBJECT_CLASS_POINT, JXG.OBJECT_CLASS_POINT],
            [JXG.OBJECT_CLASS_POINT, JXG.OBJECT_CLASS_POINT, JXG.OBJECT_CLASS_POINT, JXG.OBJECT_CLASS_POINT]]))) {
        throw new Error("JSXGraph: Can't create Arc with parent types '" +
                        (typeof parents[0]) + "' and '" + (typeof parents[1]) + "' and '" +
                        (typeof parents[2]) + "'." +
                        "\nPossible parent types: [point,point,point]");
    }

    attr = JXG.copyAttributes(attributes, board.options, 'arc');
    el = board.create('curve', [[0],[0]], attr);

    el.elType = 'arc';

    el.parents = [];
    for (i = 0; i < parents.length; i++) {
        if (parents[i].id) {
            el.parents.push(parents[i].id);
        }
    }

    /**
     * documented in JXG.GeometryElement
     * @ignore
     */
    el.type = JXG.OBJECT_TYPE_ARC;

    /**
     * Center of the arc.
     * @memberOf Arc.prototype
     * @name center
     * @type JXG.Point
     */
    el.center = JXG.getReference(board, parents[0]);

    /**
     * Point defining the arc's radius.
     * @memberOf Arc.prototype
     * @name radiuspoint
     * @type JXG.Point
     */
    el.radiuspoint = JXG.getReference(board, parents[1]);
    el.point2 = el.radiuspoint;

    /**
     * The point defining the arc's angle.
     * @memberOf Arc.prototype
     * @name anglepoint
     * @type JXG.Point
     */
    el.anglepoint = JXG.getReference(board, parents[2]);
    el.point3 = el.anglepoint;

    // Add arc as child to defining points
    el.center.addChild(el);
    el.radiuspoint.addChild(el);
    el.anglepoint.addChild(el);
    
    /**
     * TODO
     */
    el.useDirection = attr['usedirection'];      // useDirection is necessary for circumCircleArcs

    // documented in JXG.Curve
    el.updateDataArray = function() {
        var A = this.radiuspoint,
            B = this.center,
            C = this.anglepoint,
            beta, co, si, matrix, phi, i,
            x = B.X(),
            y = B.Y(),
            z = B.Z(),
            v, det, p0c, p1c, p2c,
            p1, p2, p3, p4,
            k, ax, ay, bx, by, d, r, sgn = 1.0,
            PI2 = Math.PI*0.5;
            
        phi = JXG.Math.Geometry.rad(A,B,C);
        
        if ((this.visProp.type=='minor' && phi>Math.PI) 
            || (this.visProp.type=='major' && phi<Math.PI)) { 
            phi = 2*Math.PI - phi; 
            sgn = -1.0;
        }

        if (this.useDirection) { // This is true for circumCircleArcs. In that case there is
                                  // a fourth parent element: [center, point1, point3, point2]
            p0c = parents[1].coords.usrCoords;
            p1c = parents[3].coords.usrCoords;
            p2c = parents[2].coords.usrCoords;
            det = (p0c[1]-p2c[1])*(p0c[2]-p1c[2]) - (p0c[2]-p2c[2])*(p0c[1]-p1c[1]);
            if (det < 0) {
                this.radiuspoint = parents[1];
                this.anglepoint = parents[2];
            } else {
                this.radiuspoint = parents[2];
                this.anglepoint = parents[1];
            }
        }

        p1 = [A.Z(), A.X(), A.Y()];
        p4 = p1.slice(0);
        r = B.Dist(A);
        x /= z;
        y /= z;
        this.dataX = [p1[1]/p1[0]];
        this.dataY = [p1[2]/p1[0]];
        while (phi>JXG.Math.eps) {
            if (phi>=PI2) {
                beta = PI2;
                phi -= PI2;
            } else {
                beta = phi;
                phi = 0.0;
            }

            co = Math.cos(sgn*beta);
            si = Math.sin(sgn*beta);
            matrix = [[1,        0,   0],  // z missing
                    [x*(1-co)+y*si,co,-si],
                    [y*(1-co)-x*si,si, co]];
            v = JXG.Math.matVecMult(matrix, p1);
            p4 = [v[0]/v[0], v[1]/v[0], v[2]/v[0]];

            ax = p1[1]-x;
            ay = p1[2]-y;
            bx = p4[1]-x;
            by = p4[2]-y;

            d = Math.sqrt((ax+bx)*(ax+bx) + (ay+by)*(ay+by));
            //if (beta>Math.PI) { d *= -1; }
 
            if (Math.abs(by-ay)>JXG.Math.eps) {
                k = (ax+bx)*(r/d-0.5)/(by-ay)*8.0/3.0;
            } else {
                k = (ay+by)*(r/d-0.5)/(ax-bx)*8.0/3.0;
            }

            p2 = [1, p1[1]-k*ay, p1[2]+k*ax ];
            p3 = [1, p4[1]+k*by, p4[2]-k*bx ];
        
            this.dataX = this.dataX.concat([p2[1], p3[1], p4[1]]);
            this.dataY = this.dataY.concat([p2[2], p3[2], p4[2]]);
            p1 = p4.slice(0);
        }
        this.bezierDegree = 3;

        this.updateStdform();
        this.updateQuadraticform();
    };

    /**
     * Determines the arc's current radius. I.e. the distance between {@link Arc#center} and {@link Arc#radiuspoint}.
     * @memberOf Arc.prototype
     * @name Radius
     * @function
     * @returns {Number} The arc's radius
     */
    el.Radius = function() {
        return this.radiuspoint.Dist(this.center);
    };

    /**
     * @deprecated Use {@link Arc#Radius}
     * @memberOf Arc.prototype
     * @name getRadius
     * @function
     * @returns {Number}
     */
    el.getRadius = function() {
        return this.Radius();
    };

    // documented in geometry element
    el.hasPoint = function (x, y) {
        var prec = this.board.options.precision.hasPoint/(this.board.unitX),
            checkPoint = new JXG.Coords(JXG.COORDS_BY_SCREEN, [x,y], this.board),
            r = this.Radius(),
            dist = this.center.coords.distance(JXG.COORDS_BY_USER, checkPoint),
            has = (Math.abs(dist-r) < prec),
            angle, alpha, beta;
            
        if (has) {
            angle = JXG.Math.Geometry.rad(this.radiuspoint,this.center,checkPoint.usrCoords.slice(1));
            alpha = 0.0;
            beta = JXG.Math.Geometry.rad(this.radiuspoint,this.center,this.anglepoint);
            if ((this.visProp.type=='minor' && beta>Math.PI)
                || (this.visProp.type=='major' && beta<Math.PI)) { 
                alpha = beta; 
                beta = 2*Math.PI;
            } 
            if (angle<alpha || angle>beta) { 
                has = false; 
            }
        }
        return has;    
    };

    /**
     * Checks whether (x,y) is within the sector defined by the arc.
     * @memberOf Arc.prototype
     * @name hasPointSector
     * @function
     * @param {Number} x Coordinate in x direction, screen coordinates.
     * @param {Number} y Coordinate in y direction, screen coordinates.
     * @returns {Boolean} True if (x,y) is within the sector defined by the arc, False otherwise.
     */
    el.hasPointSector = function (x, y) { 
        var checkPoint = new JXG.Coords(JXG.COORDS_BY_SCREEN, [x,y], this.board),
            r = this.Radius(),
            dist = this.center.coords.distance(JXG.COORDS_BY_USER,checkPoint),
            has = (dist<r),
            angle, alpha, beta;
        
        if (has) {
            angle = JXG.Math.Geometry.rad(this.radiuspoint,this.center,checkPoint.usrCoords.slice(1));
            alpha = 0.0;
            beta = JXG.Math.Geometry.rad(this.radiuspoint,this.center,this.anglepoint);
            if ((this.visProp.type=='minor' && beta>Math.PI) 
                || (this.visProp.type=='major' && beta<Math.PI)) { 
                alpha = beta; 
                beta = 2*Math.PI;
            } 
            if (angle<alpha || angle>beta) { 
                has = false; 
            }
        }
        return has;    
    };

    // documented in geometry element
    el.getTextAnchor = function() {
        return this.center.coords;
    };

    // documented in geometry element
    el.getLabelAnchor = function() {
        var angle,
            dx = 10/(this.board.unitX),
            dy = 10/(this.board.unitY),
            p2c = this.point2.coords.usrCoords,
            pmc = this.center.coords.usrCoords,
            bxminusax = p2c[1] - pmc[1],
            byminusay = p2c[2] - pmc[2],
            coords, vecx, vecy, len;

        if(this.label.content != null) {                          
            this.label.content.relativeCoords = new JXG.Coords(JXG.COORDS_BY_SCREEN, [0,0],this.board);                      
        }  

        angle = JXG.Math.Geometry.rad(this.radiuspoint, this.center, this.anglepoint);
        if ((this.visProp.type=='minor' && angle>Math.PI)
            || (this.visProp.type=='major' && angle<Math.PI)) { 
            angle = -(2*Math.PI - angle); 
        } 
        
        coords = new JXG.Coords(JXG.COORDS_BY_USER, 
                        [pmc[1]+ Math.cos(angle*0.5)*bxminusax - Math.sin(angle*0.5)*byminusay, 
                        pmc[2]+ Math.sin(angle*0.5)*bxminusax + Math.cos(angle*0.5)*byminusay], 
                        this.board);

        vecx = coords.usrCoords[1] - pmc[1];
        vecy = coords.usrCoords[2] - pmc[2];
    
        len = Math.sqrt(vecx*vecx+vecy*vecy);
        vecx = vecx*(len+dx)/len;
        vecy = vecy*(len+dy)/len;

        return new JXG.Coords(JXG.COORDS_BY_USER, [pmc[1]+vecx,pmc[2]+vecy], this.board);
    };
    
    /**
     * TODO description
     */
    el.updateQuadraticform = function () {
        var m = this.center,
            mX = m.X(), mY = m.Y(), r = this.Radius();
        this.quadraticform = [[mX*mX+mY*mY-r*r,-mX,-mY],
            [-mX,1,0],
            [-mY,0,1]
        ];
    };

    /**
     * TODO description
     */
    el.updateStdform = function () {
        this.stdform[3] = 0.5;
        this.stdform[4] = this.Radius();
        this.stdform[1] = -this.center.coords.usrCoords[1];
        this.stdform[2] = -this.center.coords.usrCoords[2];
        this.normalize();
    };

    el.prepareUpdate().update();
    return el;
};

JXG.JSXGraph.registerElement('arc', JXG.createArc);

/**
 * @class A semicircle is a special arc defined by two points. The arc hits both points.
 * @pseudo
 * @name Semicircle
 * @augments Arc
 * @constructor
 * @type Arc
 * @throws {Error} If the element cannot be constructed with the given parent objects an exception is thrown.
 * @param {JXG.Point_JXG.Point} p1,p2 The result will be a composition of an arc drawn clockwise from <tt>p1</tt> and
 * <tt>p2</tt> and the midpoint of <tt>p1</tt> and <tt>p2</tt>.
 * @example
 * // Create an arc out of three free points
 * var p1 = board.create('point', [4.5, 2.0]);
 * var p2 = board.create('point', [1.0, 0.5]);
 *
 * var a = board.create('semicircle', [p1, p2]);
 * </pre><div id="5385d349-75d7-4078-b732-9ae808db1b0e" style="width: 300px; height: 300px;"></div>
 * <script type="text/javascript">
 * (function () {
 *   var board = JXG.JSXGraph.initBoard('5385d349-75d7-4078-b732-9ae808db1b0e', {boundingbox: [-1, 7, 7, -1], axis: true, showcopyright: false, shownavigation: false}),
 *       p1 = board.create('point', [4.5, 2.0]),
 *       p2 = board.create('point', [1.0, 0.5]),
 *
 *       sc = board.create('semicircle', [p1, p2]);
 * })();
 * </script><pre>
 */
JXG.createSemicircle = function(board, parents, attributes) {
    var el, mp, attr;
    

    // we need 2 points
    if ( (JXG.isPoint(parents[0])) && (JXG.isPoint(parents[1])) ) {

        attr = JXG.copyAttributes(attributes, board.options, 'semicircle', 'midpoint');
        mp = board.create('midpoint', [parents[0], parents[1]], attr);

        mp.dump = false;

        attr = JXG.copyAttributes(attributes, board.options, 'semicircle');
        el = board.create('arc', [mp, parents[1], parents[0]], attr);

        el.elType = 'semicircle';
        el.parents = [parents[0].id, parents[1].id];
        el.subs = {
            midpoint: mp
        };

        /**
         * The midpoint of the two defining points.
         * @memberOf Semicircle.prototype
         * @name midpoint
         * @type Midpoint
         */
        el.midpoint = mp;
    } else
        throw new Error("JSXGraph: Can't create Semicircle with parent types '" + 
                        (typeof parents[0]) + "' and '" + (typeof parents[1]) + "'." +
                        "\nPossible parent types: [point,point]");

    return el;
};

JXG.JSXGraph.registerElement('semicircle', JXG.createSemicircle);

/**
 * @class A circumcircle arc is an {@link Arc} defined by three points. All three points lie on the arc.
 * @pseudo
 * @name CircumcircleArc
 * @augments Arc
 * @constructor
 * @type Arc
 * @throws {Error} If the element cannot be constructed with the given parent objects an exception is thrown.
 * @param {JXG.Point_JXG.Point_JXG.Point} p1,p2,p3 The result will be a composition of an arc of the circumcircle of
 * <tt>p1</tt>, <tt>p2</tt>, and <tt>p3</tt> and the midpoint of the circumcircle of the three points. The arc is drawn
 * counter-clockwise from <tt>p1</tt> over <tt>p2</tt> to <tt>p3</tt>.
 * @example
 * // Create a circum circle arc out of three free points
 * var p1 = board.create('point', [2.0, 2.0]);
 * var p2 = board.create('point', [1.0, 0.5]);
 * var p3 = board.create('point', [3.5, 1.0]);
 *
 * var a = board.create('arc', [p1, p2, p3]);
 * </pre><div id="87125fd4-823a-41c1-88ef-d1a1369504e3" style="width: 300px; height: 300px;"></div>
 * <script type="text/javascript">
 * (function () {
 *   var board = JXG.JSXGraph.initBoard('87125fd4-823a-41c1-88ef-d1a1369504e3', {boundingbox: [-1, 7, 7, -1], axis: true, showcopyright: false, shownavigation: false}),
 *       p1 = board.create('point', [2.0, 2.0]),
 *       p2 = board.create('point', [1.0, 0.5]),
 *       p3 = board.create('point', [3.5, 1.0]),
 *
 *       cca = board.create('circumcirclearc', [p1, p2, p3]);
 * })();
 * </script><pre>
 */
JXG.createCircumcircleArc = function(board, parents, attributes) {
    var el, mp, attr;
    
    // We need three points
    if ( (JXG.isPoint(parents[0])) && (JXG.isPoint(parents[1])) && (JXG.isPoint(parents[2]))) {

        attr = JXG.copyAttributes(attributes, board.options, 'circumcirclearc', 'center');
        mp = board.create('circumcenter',[parents[0], parents[1], parents[2]], attr);

        mp.dump = false;

        attr = JXG.copyAttributes(attributes, board.options, 'circumcirclearc');
        attr.usedirection = true;
        el = board.create('arc', [mp, parents[0], parents[2], parents[1]], attr);

        el.elType = 'circumcirclearc';
        el.parents = [parents[0].id, parents[1].id, parents[2].id];
        el.subs = {
            center: mp
        };

        /**
         * The midpoint of the circumcircle of the three points defining the circumcircle arc.
         * @memberOf CircumcircleArc.prototype
         * @name center
         * @type Circumcenter
         */
        el.center = mp;
    } else
        throw new Error("JSXGraph: create Circumcircle Arc with parent types '" + 
                        (typeof parents[0]) + "' and '" + (typeof parents[1]) + "' and '" + (typeof parents[2]) + "'." +
                        "\nPossible parent types: [point,point,point]");

    return el;
};

JXG.JSXGraph.registerElement('circumcirclearc', JXG.createCircumcircleArc);

/**
 * @class A minor arc is a segment of the circumference of a circle having measure less than or equal to 
 * 180 degrees (pi radians). It is defined by a center, one point that
 * defines the radius, and a third point that defines the angle of the arc.
 * @pseudo
 * @name MinorArc
 * @augments Curve
 * @constructor
 * @type JXG.Curve
 * @throws {Error} If the element cannot be constructed with the given parent objects an exception is thrown.
 * @param {JXG.Point_JXG.Point_JXG.Point} p1,p2,p3 . Minor arc is an arc of a circle around p1 having measure less than or equal to 
 * 180 degrees (pi radians) and starts at p2. The radius is determined by p2, the angle by p3. 
 * @example
 * // Create an arc out of three free points
 * var p1 = board.create('point', [2.0, 2.0]);
 * var p2 = board.create('point', [1.0, 0.5]);
 * var p3 = board.create('point', [3.5, 1.0]);
 *
 * var a = board.create('arc', [p1, p2, p3]);
 * </pre><div id="af27ddcc-265f-428f-90dd-d31ace945800" style="width: 300px; height: 300px;"></div>
 * <script type="text/javascript">
 * (function () {
 *   var board = JXG.JSXGraph.initBoard('af27ddcc-265f-428f-90dd-d31ace945800', {boundingbox: [-1, 7, 7, -1], axis: true, showcopyright: false, shownavigation: false}),
 *       p1 = board.create('point', [2.0, 2.0]),
 *       p2 = board.create('point', [1.0, 0.5]),
 *       p3 = board.create('point', [3.5, 1.0]),
 *
 *       a = board.create('minorarc', [p1, p2, p3]);
 * })();
 * </script><pre>
 */

JXG.createMinorArc = function(board, parents, attributes) {
    attributes.type = 'minor';
    return JXG.createArc(board, parents, attributes);
};

JXG.JSXGraph.registerElement('minorarc', JXG.createMinorArc);

/**
 * @class A major arc is a segment of the circumference of a circle having measure greater than or equal to 
 * 180 degrees (pi radians). It is defined by a center, one point that
 * defines the radius, and a third point that defines the angle of the arc.
 * @pseudo
 * @name MinorArc
 * @augments Curve
 * @constructor
 * @type JXG.Curve
 * @throws {Error} If the element cannot be constructed with the given parent objects an exception is thrown.
 * @param {JXG.Point_JXG.Point_JXG.Point} p1,p2,p3 . Major arc is an arc of a circle around p1 having measure greater than or equal to 
 * 180 degrees (pi radians) and starts at p2. The radius is determined by p2, the angle by p3. 
 * @example
 * // Create an arc out of three free points
 * var p1 = board.create('point', [2.0, 2.0]);
 * var p2 = board.create('point', [1.0, 0.5]);
 * var p3 = board.create('point', [3.5, 1.0]);
 *
 * var a = board.create('arc', [p1, p2, p3]);
 * </pre><div id="83c6561f-7561-4047-b98d-036248a00932" style="width: 300px; height: 300px;"></div>
 * <script type="text/javascript">
 * (function () {
 *   var board = JXG.JSXGraph.initBoard('83c6561f-7561-4047-b98d-036248a00932', {boundingbox: [-1, 7, 7, -1], axis: true, showcopyright: false, shownavigation: false}),
 *       p1 = board.create('point', [2.0, 2.0]),
 *       p2 = board.create('point', [1.0, 0.5]),
 *       p3 = board.create('point', [3.5, 1.0]),
 *
 *       a = board.create('majorarc', [p1, p2, p3]);
 * })();
 * </script><pre>
 */
JXG.createMajorArc = function(board, parents, attributes) {
    attributes.type = 'major';
    return JXG.createArc(board, parents, attributes);
};

JXG.JSXGraph.registerElement('majorarc', JXG.createMajorArc);
 
