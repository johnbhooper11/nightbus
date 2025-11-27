let map;
let destination = null;
let destinationMarker = null;
let userMarker = null;
let radiusCircle = null;
let watchId = null;
let alertRadius = 200;
let alarmSound = null;
let hasAlerted = false;

// DOM elements
const statusEl = document.getElementById('status');
const radiusSlider = document.getElementById('radius');
const radiusValueEl = document.getElementById('radius-value');
const clearBtn = document.getElementById('clear-destination');

// Initialize alarm sound
function initAlarm() {
  alarmSound = new Audio('assets/alarm.mp3');
  alarmSound.loop = true;
}

// Haversine formula to calculate distance between two coordinates
function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371e3; // Earth's radius in meters
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Update status message
function updateStatus(message, isAlert = false) {
  statusEl.textContent = message;
  if (isAlert) {
    statusEl.classList.add('alert-active');
  } else {
    statusEl.classList.remove('alert-active');
  }
}

// Save destination to local storage
function saveDestination() {
  if (destination) {
    localStorage.setItem('nightbus_destination', JSON.stringify({
      lat: destination.lat,
      lng: destination.lng,
      radius: alertRadius
    }));
  }
}

// Load destination from local storage
function loadDestination() {
  const saved = localStorage.getItem('nightbus_destination');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      destination = { lat: data.lat, lng: data.lng };
      alertRadius = data.radius || 200;
      radiusSlider.value = alertRadius;
      radiusValueEl.textContent = alertRadius;
      return true;
    } catch (e) {
      console.error('Failed to load saved destination:', e);
    }
  }
  return false;
}

// Clear destination
function clearDestination() {
  destination = null;
  hasAlerted = false;

  if (destinationMarker) {
    destinationMarker.setMap(null);
    destinationMarker = null;
  }

  if (radiusCircle) {
    radiusCircle.setMap(null);
    radiusCircle = null;
  }

  if (alarmSound) {
    alarmSound.pause();
    alarmSound.currentTime = 0;
  }

  localStorage.removeItem('nightbus_destination');
  updateStatus('Tap on the map to set your destination');
  clearBtn.disabled = true;
}

// Set destination on map
function setDestination(latLng) {
  destination = {
    lat: latLng.lat(),
    lng: latLng.lng()
  };
  hasAlerted = false;

  // Remove existing destination marker and circle
  if (destinationMarker) {
    destinationMarker.setMap(null);
  }
  if (radiusCircle) {
    radiusCircle.setMap(null);
  }

  // Create destination marker
  destinationMarker = new google.maps.Marker({
    position: destination,
    map: map,
    title: 'Destination',
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 12,
      fillColor: '#e74c3c',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2
    }
  });

  // Create radius circle
  radiusCircle = new google.maps.Circle({
    strokeColor: '#4a90d9',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: '#4a90d9',
    fillOpacity: 0.2,
    map: map,
    center: destination,
    radius: alertRadius
  });

  saveDestination();
  updateStatus(`Destination set! Alert when within ${alertRadius}m`);
  clearBtn.disabled = false;
}

// Update radius circle
function updateRadiusCircle() {
  if (radiusCircle) {
    radiusCircle.setRadius(alertRadius);
  }
}

// Handle position update
function handlePositionUpdate(pos) {
  const userPos = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude
  };

  // Update user marker
  if (userMarker) {
    userMarker.setPosition(userPos);
  } else {
    userMarker = new google.maps.Marker({
      position: userPos,
      map: map,
      title: 'You are here',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#4a90d9',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2
      }
    });
  }

  // Check proximity to destination
  if (destination && !hasAlerted) {
    const distance = haversineDistance(
      userPos.lat,
      userPos.lng,
      destination.lat,
      destination.lng
    );

    if (distance < alertRadius) {
      // Within range - trigger alert!
      hasAlerted = true;
      updateStatus(`You've arrived! (${Math.round(distance)}m away)`, true);

      // Play alarm sound
      if (alarmSound) {
        alarmSound.play().catch(e => console.log('Audio play failed:', e));
      }

      // Browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nightbus Alert!', {
          body: `You're within ${alertRadius}m of your destination!`,
          icon: '🚍'
        });
      }

      // Fallback to alert
      setTimeout(() => {
        alert(`You're within ${alertRadius}m of your stop!`);
      }, 100);
    } else {
      updateStatus(`${Math.round(distance)}m to destination`);
    }
  }
}

// Handle geolocation error
function handlePositionError(err) {
  console.error('Geolocation error:', err);
  let message = 'Unable to get your location';

  switch (err.code) {
    case err.PERMISSION_DENIED:
      message = 'Location access denied. Please enable location services.';
      break;
    case err.POSITION_UNAVAILABLE:
      message = 'Location information unavailable.';
      break;
    case err.TIMEOUT:
      message = 'Location request timed out.';
      break;
  }

  updateStatus(message);
}

// Initialize map
function initMap() {
  // Default center (San Francisco)
  const defaultCenter = { lat: 37.7749, lng: -122.4194 };

  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 15,
    center: defaultCenter,
    styles: [
      // Dark mode map style
      { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#38414e' }]
      },
      {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#212a37' }]
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#17263c' }]
      }
    ]
  });

  // Initialize alarm
  initAlarm();

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Load saved destination
  const hasSavedDestination = loadDestination();

  // Get current position and center map
  navigator.geolocation.getCurrentPosition(
    pos => {
      const userPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      map.setCenter(userPos);

      // Create user marker
      userMarker = new google.maps.Marker({
        position: userPos,
        map: map,
        title: 'You are here',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#4a90d9',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2
        }
      });

      // If we have a saved destination, show it
      if (hasSavedDestination && destination) {
        setDestination(new google.maps.LatLng(destination.lat, destination.lng));
      }
    },
    handlePositionError,
    { enableHighAccuracy: true }
  );

  // Map click to set destination
  map.addListener('click', (e) => {
    setDestination(e.latLng);
  });

  // Start watching position
  watchId = navigator.geolocation.watchPosition(
    handlePositionUpdate,
    handlePositionError,
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 10000
    }
  );

  // Radius slider handler
  radiusSlider.addEventListener('input', (e) => {
    alertRadius = parseInt(e.target.value, 10);
    radiusValueEl.textContent = alertRadius;
    updateRadiusCircle();
    if (destination) {
      saveDestination();
      updateStatus(`Alert radius set to ${alertRadius}m`);
    }
  });

  // Clear destination button handler
  clearBtn.addEventListener('click', clearDestination);
  clearBtn.disabled = !hasSavedDestination;
}

// Expose initMap globally for Google Maps callback
window.initMap = initMap;
