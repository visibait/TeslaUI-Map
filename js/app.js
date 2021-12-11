$(function() {
	var showCoordinations = true;


	var $types = $('.types');

	var onResize = function() {
		$types.css({
			maxHeight: $(window).height() - parseInt($types.css('marginTop'), 10) - parseInt($types.css('marginBottom'), 10) - parseInt($('header').height()) + 6
		});
	};

	onResize();

	$(window).resize(onResize);

	
	var currentMarker;
	
	var assetsUrl = function() {
		return 'https://skyrossm.github.io/np-gangmap/';
	};

	Handlebars.registerHelper('assetsUrl', assetsUrl);

	var timestampToSeconds = function(stamp) {
		stamp = stamp.split(':');
		return (parseInt(stamp[0], 10) * 60) + parseInt(stamp[1], 10);
	};

	Handlebars.registerHelper('timestampToSeconds', timestampToSeconds);

	var Vent = _.extend({}, Backbone.Events);

	var LocationModel = Backbone.Model.extend({
		initialize: function() {
			var polyCoords = this.get('latlngarray');
			
			var marker = new google.maps.Polygon({
				paths: polyCoords,
				strokeColor: this.get('strokecolor'),
				strokeOpacity: 0.8,
				strokeWeight: 2,
				fillColor: this.get('fillcolor'),
				fillOpacity: 0.35
			});
			
			var bounds = new google.maps.LatLngBounds()
			polyCoords.forEach(function(element,index){bounds.extend(element)})
			
			var mapLabel = new MapLabel({
				position: bounds.getCenter(),
				text: this.get('title'),
				strokeWeight: 1,
				strokeColor: "#000",
				fontColor: this.get('fillcolor'),
				zIndex: 10000
			});
		
			_.bindAll(this, 'markerClicked');
			google.maps.event.addListener(marker, 'click', this.markerClicked);
			this.set({ marker: marker, label: mapLabel });
			
		},

		markerClicked: function() {
			Vent.trigger('location:clicked', this);
		},

		highlightMarker: function() {
			if (currentMarker == this) {
				Vent.trigger('location:clicked', this);
			}
			else {
				if (currentMarker) currentMarker.removeHighlight();
				mapView.closePopupLocation();
				currentMarker = this;
			}
		}
	});
	var LocationsCollection = Backbone.Collection.extend({
		model: LocationModel,
		url: 'locations.json'
	});

	var locations = window.locations = new LocationsCollection();

	var CategoryModel = Backbone.Model.extend({ });
	var CategoriesCollection = Backbone.Collection.extend({

		model: CategoryModel,

		getIcon: function(type) {
			var o = this.findWhere({ name: type });
			if (o) {
				return o.get('icon');
			}

			return assetsUrl() + (o ? o.get('icon') : 'blank.png');
		},

		forView: function(type) {
			var g = this.groupBy('type');
			return _(g).map(function(categories, type) {
				return {
					name: type,
					types: _.map(categories, function(category) { return category.toJSON(); })
				}
			});
		}

	});

	var categories = window.cats = new CategoriesCollection([
		{
			name: 'Territory Areas',
			icon: 'General/wall-breach.png',
			type: 'General',
			enabled: true
		},
		{
			name: 'Neutral Zones',
			icon: 'General/wall-breach.png',
			type: 'General',
			enabled: true
		}
	]);
	var showingLabels;
	

	var MapView = Backbone.View.extend({

		initialize: function() {
			this.mapType = 'Atlas';
			this.mapDetails = { 'Atlas': '#0fa8d2', 'Satellite': '#143d6b', 'Road': '#1862ad' };
			this.mapOptions = {
				center: new google.maps.LatLng(66, -125),
				zoom: 5,
				disableDefaultUI: true,
				mapTypeId: this.mapType,
				backgroundColor:  'hsla(0, 0%, 0%, 0)'
			};

			_.bindAll(this, 'getTileImage', 'updateMapBackground');

			this.popupTemplate = Handlebars.compile($('#markerPopupTemplate2').html());
		},

		render: function() {
			var map = this.map = window.map = new google.maps.Map(this.el, this.mapOptions);

			this.initMapTypes(map, _.keys(this.mapDetails));

			google.maps.event.addListener(map, 'maptypeid_changed', this.updateMapBackground);

			window.locs = [];
			google.maps.event.addListener(map, 'rightclick', function(e) {
				var marker = new google.maps.Marker({
					map: map,
					moveable: true,
					draggable: true,
					position: e.latLng
				});
				window.locs.push(marker);
			});

			return this;
		},

		initMapTypes: function(map, types) {
			_.each(types, function(type) {
				var mapTypeOptions = {
					maxZoom: 7,
					minZoom: 3,
					name: type,
					tileSize: new google.maps.Size(256, 256),
					getTileUrl: this.getTileImage
				};
				map.mapTypes.set(type, new google.maps.ImageMapType(mapTypeOptions));
			}, this);
		},

		updateMapBackground: function() {
			this.mapType = this.map.getMapTypeId();
			this.$el.css({
				backgroundColor: this.mapDetails[this.mapType]
			});
		},

		getTileImage: function(rawCoordinates, zoomLevel) {
			var coord = this.normalizeCoordinates(rawCoordinates, zoomLevel);
			if ( ! coord) {
				return null;
			}
			return assetsUrl() + 'tiles/' + this.mapType.toLowerCase() + '/' + zoomLevel + '-' + coord.x + '_' + coord.y + '.png';
		},

		normalizeCoordinates: function(coord, zoom) {
			var y = coord.y;
			var x = coord.x;
			var tileRange = 1 << zoom;

			if (y < 0 || y >= tileRange) {
				return null;
			}

			if (x < 0 || x >= tileRange) {
				x = (x % tileRange + tileRange) % tileRange;
			}

			return {
				x: x,
				y: y
			};
		},
	});

	var mapView = new MapView({
		el: '#map'
	});

	mapView.render();
});
