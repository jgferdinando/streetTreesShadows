mapboxgl.accessToken =
  "pk.eyJ1IjoiamdmOTQiLCJhIjoiY2thaXk2bjQzMDZvYzJ3cXoxeThnODU5NyJ9.o1ijddB0igPdlsWMw6iRVw";
const { MapboxLayer, PointCloudLayer } = deck;

var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/jgf94/ckg7ai9oo06zj19p6zw741oe2",
  center: [-73.9867, 40.6845],
  zoom: 20,
  pitch: 15,
  bearing: 0,
  antialias: true,
});

/////////////

var lat;
var lon;
var species;
var date;
var buildings;
var hullPoints;

var sinAz;
var cosAz;
var tanAz;
var sinAmp;
var cosAmp;
var tanAmp;

var shadedPoints = [];
var shadingPoints = [];
var otherPoints = [];

var building;
var selectedBins = [];
var buildingFilter = ["in", "bin"];

//

//

fetch("./data/bondGardenBuildingWest.geojson")
  .then((response) => response.json())
  .then((data) => (buildings = data))
  .then((json) => (building = buildings.features[0]));

////////////

map.on("load", function () {
  map.removeLayer("building");

  map.addSource("trees", {
    type: "geojson",
    data: "./data/tile987187.geojson",
  });

  map.addSource("treespoly", {
    type: "geojson",
    data: "./data/tile987187polygon.geojson",
  });

  map.addSource("buildings", {
    type: "geojson",
    data: "./data/tile987187buildings.geojson",
  });

  map.addLayer({
    id: "buildingExtruded",
    source: "buildings",
    filter: ["in", "bin", ""],
    layout: { visibility: "visible" },
    type: "fill-extrusion",
    minzoom: 15,
    paint: {
      "fill-extrusion-color": "rgb(225,220,215)",
      "fill-extrusion-height": ["/", ["get", "heightroof"], 3.28],
      "fill-extrusion-opacity": 0.5,
    },
  });

  map.addLayer({
    id: "buildingfootprints",
    source: "buildings",
    layout: { visibility: "visible" },
    type: "fill",
    paint: {
      "fill-color": "#808080",
      "fill-opacity": 0.1,
    },
  });

  map.addLayer({
    id: "trees1",
    type: "circle",
    source: "trees",
    layout: { visibility: "visible" },
    paint: {
      // make circles larger as the user zooms from z12 to z22
      "circle-radius": {
        base: 1,
        stops: [
          [15, 1.5],
          [17, 3],
          [22, 24],
        ],
      },
      "circle-pitch-alignment": "map",
      "circle-color": "rgba(255,255,255,0)",
      "circle-stroke-color": [
        "interpolate",
        ["linear"],
        ["get", "zrange"],
        0,
        "rgba(200,100,50,0.8)",
        65,
        "rgba(50,200,75,1)",
      ],
      "circle-stroke-width": {
        base: 1,
        stops: [
          [15, 0.7],
          [17, 1],
          [22, 5],
        ],
      },
      "circle-opacity": 1,
    },
  });

  //

  map.on("mouseenter", "trees1", function (e) {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "trees1", function () {
    map.getCanvas().style.cursor = "";
  });
  map.on("mouseenter", "buildingfootprints", function (e) {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "buildingfootprints", function () {
    map.getCanvas().style.cursor = "";
  });

  //

  var treeID;

  function shadow(treeID, date) {
    var pointCloudFile = "data/pointCloudJSONs/";
    var pointCloudFile = pointCloudFile.concat(treeID);
    var pointCloudFile = pointCloudFile.concat(".json");
    var shadow = "shadow".concat(treeID);

    var sunPosition = SunCalc.getPosition(date, lat, lon);
    var az = (sunPosition["azimuth"] * 180) / Math.PI;
    var amp = (sunPosition["altitude"] * 180) / Math.PI;

    var az = parseFloat(az);
    var amp = parseFloat(amp);

    sinAz = Math.sin((az * Math.PI) / 180);
    cosAz = Math.cos((az * Math.PI) / 180);
    tanAz = Math.tan((az * Math.PI) / 180);
    sinAmp = Math.sin(((amp - 90) * Math.PI) / 180);
    cosAmp = Math.cos(((amp - 90) * Math.PI) / 180);
    tanAmp = Math.tan((-amp * Math.PI) / 180);

    //start update tree

    map.removeLayer("tree");
    shadedPoints = [];
    shadingPoints = [];
    otherPoints = [];

    map.addLayer(
      new MapboxLayer({
        id: "tree",
        type: PointCloudLayer,
        data: pointCloudFile,
        getPosition: (d) => [d[1], d[0], d[2]],
        getColor: (d) =>
          pointColor([d[1], d[0], d[2]], hullPoints, tanAmp, sinAmp, cosAz),
        sizeUnits: "feet",
        pointSize: 3,
        opacity: 0.8,
        visible: true,
      })
    );

    //end update tree

    //add in building shadow code

    var buildingHeight = building.properties.heightroof;
    var buildingPoints = building.geometry.coordinates[0][0];

    var buildingPointsGround = [];
    for (let i = 0; i < buildingPoints.length; i++) {
      buildingPointsGround.push(buildingPoints[i]);
      var x = buildingPoints[i][0];
      var y = buildingPoints[i][1];
      var z = buildingHeight / 3.28;
      var buildingPointGround = [
        x - ((z / tanAmp) * sinAz) / 84540.7,
        y - ((z / tanAmp) * cosAz) / 111047.7,
      ];
      buildingPointsGround.push(buildingPointGround);
    }

    var hullPoints = convexHull(buildingPointsGround);

    var buildingSourceName = "buildingShadowSourceEast";
    var buildingLayerName = "buildingShadowLayerEast";

    map.addSource(buildingSourceName, {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: {
          type: "Polygon",
          // These coordinates outline Maine.
          coordinates: [hullPoints],
        },
      },
    });

    map.addLayer({
      id: buildingLayerName,
      type: "fill",
      source: buildingSourceName, // reference the data source
      layout: {},
      paint: {
        "fill-color": "#424359", // blue color fill
        "fill-opacity": 0.2,
      },
    });

    //end building shadow code

    map.addLayer(
      new MapboxLayer({
        id: "shadow",
        type: PointCloudLayer,
        data: pointCloudFile,
        getPosition: (d) => [
          d[1] - ((d[2] / tanAmp) * sinAz) / 84540.7,
          d[0] - ((d[2] / tanAmp) * cosAz) / 111047.7,
          d[2] * 0,
        ], //approx degree to meter conversion from here: http://www.csgnetwork.com/degreelenllavcalc.html
        getColor: (d) =>
          pointColor([d[1], d[0], d[2]], hullPoints, tanAmp, sinAmp, cosAz), // [ d[2] , d[2], d[2], 255*(d[5]-d[4])-d[2] ],
        sizeUnits: "feet",
        pointSize: 4,
        opacity: 0.1,
        visible: true,
      })
    );

    //htmlCountUpdate( () => { } );
  }

  function stretchHoursBar() {
    var day = parseFloat(document.getElementById("dayslider").value);
    var hour = parseFloat(document.getElementById("hourslider").value);

    var date = new Date("2022-01-01 00:00");
    date.setDate(date.getDate() + day);
    date.setTime(date.getTime() + hour * 60 * 60 * 1000);
    var offset = date.getTimezoneOffset();

    var dist = 183 - Math.abs(183 - day);
    var adjusted = (dist * 114) / 183;

    var times = SunCalc.getTimes(date, 40.7, -70.6);
    var min =
      times.sunrise.getHours() +
      times.sunrise.getMinutes() / 60.0 -
      offset / 60 +
      0.5;
    var max =
      times.sunset.getHours() +
      times.sunset.getMinutes() / 60.0 -
      offset / 60 -
      0.5;

    var width = (max - min) * 4;
    var buffer = (100 - width) / 2;
    document.getElementById("hourslider").min = min;
    document.getElementById("hourslider").max = max;
    document.getElementById("hourslider").style.width = width
      .toString()
      .concat("%");
    document.getElementById("hourslider").style.marginLeft = buffer
      .toString()
      .concat("%");
  }

  map.on("click", "trees1", function (e) {
    map.removeLayer("tree");
    map.removeLayer("shadow");

    treeID = e.features[0].properties["tree_id"];

    lat = e.features[0].properties["Latitude"];
    lon = e.features[0].properties["longitude"];
    species = e.features[0].properties["spc_common"];
    console.log(treeID, species);

    var pointCloudFile = "data/pointCloudJSONs/";
    var pointCloudFile = pointCloudFile.concat(treeID);
    var pointCloudFile = pointCloudFile.concat(".json");

    map.addLayer(
      new MapboxLayer({
        id: "tree",
        type: PointCloudLayer,
        data: pointCloudFile,
        getPosition: (d) => [d[1], d[0], d[2]],
        getColor: (d) => [
          d[3] * 255,
          d[3] * 127 + d[3] * 127 * (d[5] - d[4] + 1),
          d[3] * 255,
          255 * (d[5] - d[4]),
        ],
        sizeUnits: "feet",
        pointSize: 3,
        opacity: 0.8,
        visible: true,
      })
    );

    var day = parseFloat(document.getElementById("dayslider").value);
    var hour = parseFloat(document.getElementById("hourslider").value);

    date = new Date("2022-01-01 00:00");
    date.setDate(date.getDate() + day);
    var offset = date.getTimezoneOffset();
    date.setTime(date.getTime() + hour * 60 * 60 * 1000 + offset * 60 * 1000);

    document.getElementById("common").innerHTML = species
      .concat("<br> @ ")
      .concat(date.toString().split("(").slice(0, 1));
    var link = "https://www.designacrossscales.org/public_test/html/".concat(
      species,
      ".html"
    );
    document.getElementById("common").setAttribute("href", link);
    document.getElementById("common").setAttribute("href", link);
    document.getElementById("latin").innerHTML =
      e.features[0].properties["spc_latin"];
    document.getElementById("address").innerHTML =
      e.features[0].properties["address"];
    //document.getElementById("zipcode").innerHTML = e.features[0].properties['zipcode'];
    //document.getElementById("borough").innerHTML = e.features[0].properties['boroname'];
    //document.getElementById("curb").innerHTML = e.features[0].properties['curb_loc'];
    //document.getElementById("lat").innerHTML = lat;
    //document.getElementById("lon").innerHTML = lon;
    document.getElementById("status").innerHTML =
      e.features[0].properties["status"];
    document.getElementById("health").innerHTML =
      e.features[0].properties["health"];
    document.getElementById("trunk").innerHTML =
      e.features[0].properties["tree_dbh"];
    document.getElementById("canopy").innerHTML =
      e.features[0].properties["canopy_radius_calc_ft"];
    document.getElementById("height").innerHTML =
      e.features[0].properties["zrange"];
    document.getElementById("density").innerHTML =
      e.features[0].properties["density"];

    shadow(treeID, date);
    stretchHoursBar();
  });

  map.on("click", "buildingfootprints", function (e) {
    var bin = e.features[0].properties["bin"];
    selectedBins.push(bin);
    console.log(selectedBins);

    map.setFilter("buildingExtruded", ["in", "bin", ...selectedBins]);

    function buildingShadowUpdate(buildings) {
      //console.log(buildings.features)

      for (let i = 0; i < buildings.features.length; i++) {
        if (buildings.features[i].properties.bin == bin) {
          building = buildings.features[i];
        } else {
        }
      }
      return building;
    }

    fetch("./data/tile987187buildings.geojson")
      .then((response) => response.json())
      .then((data) => (buildings = data))
      .then((json) => (building = buildingShadowUpdate(buildings)));
  });

  document.getElementById("dayslider").addEventListener("input", function (h) {
    var day = parseFloat(document.getElementById("dayslider").value);
    var hour = parseFloat(document.getElementById("hourslider").value);
    date = new Date("2022-01-01 00:00");
    date.setDate(date.getDate() + day);
    var offset = date.getTimezoneOffset();
    date.setTime(date.getTime() + hour * 60 * 60 * 1000 + offset * 60 * 1000);
    document.getElementById("common").innerHTML = species
      .concat("<br> @ ")
      .concat(date.toString().split("(").slice(0, 1));
    map.removeLayer("shadow");

    map.removeLayer("buildingShadowLayerEast");
    map.removeSource("buildingShadowSourceEast");

    shadow(treeID, date);

    stretchHoursBar();
  });

  document.getElementById("hourslider").addEventListener("input", function (h) {
    var day = parseFloat(document.getElementById("dayslider").value);
    var hour = parseFloat(document.getElementById("hourslider").value);
    //import suncalc from "suncalc";
    date = new Date("2022-01-01 00:00");
    date.setDate(date.getDate() + day);
    var offset = date.getTimezoneOffset();
    date.setTime(date.getTime() + hour * 60 * 60 * 1000 + offset * 60 * 1000);
    document.getElementById("common").innerHTML = species
      .concat("<br> @ ")
      .concat(date.toString().split("(").slice(0, 1));
    map.removeLayer("shadow");

    map.removeLayer("buildingShadowLayerEast");
    map.removeSource("buildingShadowSourceEast");

    shadow(treeID, date);
  });
});

//big thanks to: http://www.bitbanging.space/posts/convex-hull-algorithms-for-a-set-of-points
function polarAngle(a, b, c) {
  let x = (a[0] - b[0]) * (c[0] - b[0]) + (a[1] - b[1]) * (c[1] - b[1]);
  let y = (a[0] - b[0]) * (c[1] - b[1]) - (c[0] - b[0]) * (a[1] - b[1]);
  return Math.atan2(y, x);
}
function convexHull(p_list) {
  if (p_list.length < 3) return p_list;

  let hull = [];
  let tmp;

  // Find leftmost point
  tmp = p_list[0];
  for (const p of p_list) if (p[0] < tmp[0]) tmp = p;

  hull[0] = tmp;

  let endpoint, secondlast;
  let min_angle, new_end;

  endpoint = hull[0];
  secondlast = [endpoint[0], endpoint[1] + 10];

  do {
    min_angle = Math.PI; // Initial value. Any angle must be lower that 2PI
    for (const p of p_list) {
      tmp = polarAngle(secondlast, endpoint, p);

      if (tmp <= min_angle) {
        new_end = p;
        min_angle = tmp;
      }
    }

    if (new_end != hull[0]) {
      hull.push(new_end);
      secondlast = endpoint;
      endpoint = new_end;
    }
  } while (new_end != hull[0]);
  return hull;
}

//https://stackoverflow.com/questions/22521982/check-if-point-is-inside-a-polygon
function inside(point, vs) {
  // ray-casting algorithm based on
  // https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html/pnpoly.html

  var x = point[0];
  var y = point[1];

  var inside = false;
  for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    var xi = vs[i][0],
      yi = vs[i][1];
    var xj = vs[j][0],
      yj = vs[j][1];

    var intersect =
      yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

function pointColor(point, vs, tanAmp, sinAmp, cosAz) {
  var x = point[0];
  var y = point[1];
  var z = point[2];

  var xg = x - ((z / tanAmp) * sinAz) / 84540.7;
  var yg = y - ((z / tanAmp) * cosAz) / 111047.7;

  var insideSky = inside([x, y], vs);
  var insideGround = inside([xg, yg], vs);

  if (insideGround && insideSky) {
    shadedPoints.push([x, y, z]);
    return [25 + z * 5, 50 + z * 8, 100 + z * 7];
  } else if (insideGround && insideSky == false) {
    shadingPoints.push([x, y, z]);
    return [255, 50 + z * 10, 75];
  } else {
    otherPoints.push([x, y, z]);
    return [75 + z * z * 0.75, 175 + z * 10, 10 + z * 5];
  }
}

function htmlCountUpdate(_callback) {
  console.log(shadedPoints.length);
  console.log(shadingPoints.length);
  console.log(otherPoints.length);

  document.getElementById("inshadow").innerHTML =
    shadedPoints.length.toString();
  document.getElementById("shadingbuilding").innerHTML =
    shadingPoints.length.toString();
  document.getElementById("shadingground").innerHTML =
    otherPoints.length.toString();

  _callback();
}
