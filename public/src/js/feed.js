var shareImageButton = document.querySelector('#share-image-button');
var createPostArea = document.querySelector('#create-post');
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
var sharedMomentsArea = document.querySelector('#shared-moments');
var form = document.querySelector('form');
var titleInput = document.querySelector('#title');
var locationInput = document.querySelector('#location');
var videoPlayer = document.querySelector('#player');
var canvasElement = document.querySelector('#canvas');
var captureButton = document.querySelector('#capture-btn');
var retakeButton = document.querySelector('#retake-btn');
var imagePicker = document.querySelector('#image-picker');
var imagePickerArea = document.querySelector('#pick-image');
var locationBtn = document.querySelector('#location-btn');
var locationLoader = document.querySelector('#location-loader');
var DEFAULT_IMAGE = 'https://firebasestorage.googleapis.com/v0/b/proyeto-del-curso.firebasestorage.app/o/sf-boat.jpg?alt=media&token=1c264061-7918-4a64-b15e-d14f8d7ed95f';
var MAX_IMAGE_WIDTH = 640;
var picture = null;      // foto en data URL (JPEG) lista para guardarse con el post
var fetchedLocation = null;

// ---------- Cámara ----------

function initializeMedia() {
  if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
    imagePickerArea.style.display = 'block';
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(function (stream) {
      videoPlayer.srcObject = stream;
      videoPlayer.style.display = 'block';
      captureButton.style.display = 'inline-block';
      imagePickerArea.style.display = 'block';
    })
    .catch(function (err) {
      console.warn('[Cámara] Sin acceso a la cámara; se ofrece elegir una imagen.', err);
      imagePickerArea.style.display = 'block';
    });
}

function stopMedia() {
  if (videoPlayer.srcObject) {
    videoPlayer.srcObject.getVideoTracks().forEach(function (track) {
      track.stop();
    });
    videoPlayer.srcObject = null;
  }
}

// Dibuja una imagen o un cuadro de video en el canvas, reducida a MAX_IMAGE_WIDTH, y la guarda como JPEG.
function drawToCanvas(source, width, height) {
  var scale = Math.min(1, MAX_IMAGE_WIDTH / width);
  canvasElement.width = Math.round(width * scale);
  canvasElement.height = Math.round(height * scale);
  canvasElement.getContext('2d').drawImage(source, 0, 0, canvasElement.width, canvasElement.height);
  canvasElement.style.display = 'block';
  picture = canvasElement.toDataURL('image/jpeg', 0.7);
}

captureButton.addEventListener('click', function () {
  drawToCanvas(videoPlayer, videoPlayer.videoWidth, videoPlayer.videoHeight);
  videoPlayer.style.display = 'none';
  captureButton.style.display = 'none';
  retakeButton.style.display = 'inline-block';
  stopMedia();
});

retakeButton.addEventListener('click', function () {
  picture = null;
  canvasElement.style.display = 'none';
  retakeButton.style.display = 'none';
  imagePicker.value = '';
  initializeMedia();
});

imagePicker.addEventListener('change', function (event) {
  var file = event.target.files[0];
  if (!file) {
    return;
  }
  var img = new Image();
  img.onload = function () {
    stopMedia();
    videoPlayer.style.display = 'none';
    captureButton.style.display = 'none';
    drawToCanvas(img, img.naturalWidth, img.naturalHeight);
    retakeButton.style.display = 'inline-block';
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
});

// ---------- Geolocalización ----------

function initializeLocation() {
  if (!('geolocation' in navigator)) {
    locationBtn.style.display = 'none';
  }
}

function setLocationText(text) {
  locationInput.value = text;
  document.querySelector('#manual-location').classList.add('is-focused', 'is-dirty');
}

locationBtn.addEventListener('click', function () {
  if (!('geolocation' in navigator)) {
    return;
  }
  locationBtn.style.display = 'none';
  locationLoader.style.display = 'inline-block';

  navigator.geolocation.getCurrentPosition(function (position) {
    fetchedLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
    var coords = fetchedLocation.lat.toFixed(5) + ', ' + fetchedLocation.lng.toFixed(5);
    // Nombre del lugar con OpenStreetMap (Nominatim); sin red se quedan las coordenadas.
    fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=es&lat=' +
      fetchedLocation.lat + '&lon=' + fetchedLocation.lng)
      .then(function (res) { return res.json(); })
      .then(function (place) {
        var a = place.address || {};
        var name = [a.suburb || a.neighbourhood || a.village, a.city || a.town || a.municipality, a.state]
          .filter(Boolean).join(', ');
        setLocationText(name || coords);
      })
      .catch(function () {
        setLocationText(coords);
      })
      .then(function () {
        locationBtn.style.display = 'inline-block';
        locationLoader.style.display = 'none';
      });
  }, function (err) {
    console.warn('[GPS] No se pudo obtener la ubicación.', err);
    locationBtn.style.display = 'inline-block';
    locationLoader.style.display = 'none';
    showPostMessage('No se pudo obtener tu ubicación; escríbela manualmente.');
  }, { timeout: 10000, enableHighAccuracy: true });
});

function resetMediaAndLocation() {
  stopMedia();
  picture = null;
  fetchedLocation = null;
  imagePicker.value = '';
  [videoPlayer, canvasElement, captureButton, retakeButton, imagePickerArea, locationLoader].forEach(function (el) {
    el.style.display = 'none';
  });
  locationBtn.style.display = 'inline-block';
}

function openCreatePostModal() {
  // createPostArea.style.display = 'block';

  createPostArea.style.transform = 'translateY(0)';
  initializeMedia();
  initializeLocation();
  if (deferredPrompt) {
    deferredPrompt.prompt();

    deferredPrompt.userChoice.then(function (choiceResult) {
      console.log(choiceResult.outcome);

      if (choiceResult.outcome === 'dismissed') {
        console.log('User cancelled installation');
      } else {
        console.log('User added to home screen');
      }
    });

    deferredPrompt = null;
  }
}

function closeCreatePostModal() {
  //createPostArea.style.display = 'none';
  createPostArea.style.transform = 'translateY(100vh)';
  resetMediaAndLocation();
}


shareImageButton.addEventListener('click', openCreatePostModal);
closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);

function clearCards() {
  while (sharedMomentsArea.hasChildNodes()) {
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
  }
}

function createCard(data) {
  var cardWrapper = document.createElement('div');
  cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';
  var cardTitle = document.createElement('div');
  cardTitle.className = 'mdl-card__title';
  cardTitle.style.height = '180px';
  var cardImage = document.createElement('img');
  cardImage.className = 'shared-moment-card__image';
  cardImage.alt = data.title || 'Imagen de la publicación';
  cardImage.onerror = function () {
    cardImage.onerror = null;
    cardImage.src = '/src/images/main-image.jpg';
  };
  cardImage.src = data.image || '/src/images/main-image.jpg';
  cardTitle.appendChild(cardImage);
  cardWrapper.appendChild(cardTitle);
  var cardTitleTextElement = document.createElement('h2');
  cardTitleTextElement.style.color = 'white';
  cardTitleTextElement.className = 'mdl-card__title-text';
  cardTitleTextElement.textContent = data.title;
  cardTitle.appendChild(cardTitleTextElement);
  var cardSupportingText = document.createElement('div');
  cardSupportingText.className = 'mdl-card__supporting-text';
  cardSupportingText.textContent = data.location;
  cardSupportingText.style.textAlign = 'center';
  cardWrapper.appendChild(cardSupportingText);
  componentHandler.upgradeElement(cardWrapper);
  sharedMomentsArea.appendChild(cardWrapper);
}

function updateUI(data) {
  clearCards();
  // Más recientes primero (el id es la fecha ISO de creación).
  data = data.slice().sort(function (a, b) {
    return (Date.parse(b.id) || 0) - (Date.parse(a.id) || 0);
  });
  for (var i = 0; i < data.length; i++) {
    createCard(data[i]);
  }
}

var url = 'https://proyeto-del-curso-default-rtdb.firebaseio.com/post.json';
var networkDataReceived = false;

fetch(url)
  .then(function (res) {
    if (!res.ok) {
      throw new Error('Feed request failed with status ' + res.status);
    }
    return res.json();
  })
  .then(function (data) {
    networkDataReceived = true;
    console.log('From web', data);
    var dataArray = [];
    for (var key in data) {
      dataArray.push(data[key]);
      writeData('posts', data[key]);
    }
    updateUI(dataArray);
  })
  .catch(function (err) {
    console.warn('[Feed] Could not load posts from the network; showing saved posts when available.', err);
  });

if ('indexedDB' in window) {
  readAllData('posts')
    .then(function (data) {
      if (!networkDataReceived) {
        console.log('From cache', data);
        updateUI(data);
      }
    });

}

function sendData() {
  return readAllData('sync-posts')
    .then(function (posts) {
      return Promise.all(posts.map(function (post) {
        var postId = post.id.replace(/[.#$\/\[\]]/g, '_');
        return fetch('https://proyeto-del-curso-default-rtdb.firebaseio.com/post/' +
          encodeURIComponent(postId) + '.json?x-http-method-override=PUT', {
          // POST "simple" (text/plain) para evitar el preflight CORS; Firebase lo trata como PUT.
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=UTF-8'
          },
          body: JSON.stringify(post)
        }).then(function (res) {
          if (!res.ok) {
            throw new Error('Post sync failed with status ' + res.status);
          }
          console.log('[Feed] Post enviado desde la página', post.id);
          return deleteItemFromData('sync-posts', post.id)
            .then(function () {
              return notifyNewPost(post);
            });
        });
      }));
    })
    .then(function () {
      return 'sent';
    })
    .catch(function (err) {
      console.warn('[Feed] Posts remain saved locally and will retry when online.', err);
      return false;
    });
}

function showPostMessage(message) {
  var snackbarContainer = document.querySelector('#confirmation-toast');
  if (snackbarContainer && snackbarContainer.MaterialSnackbar) {
    snackbarContainer.MaterialSnackbar.showSnackbar({ message: message });
  } else {
    console.info(message);
  }
}

function registerPostSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    return navigator.serviceWorker.ready
      .then(function (registration) {
        return registration.sync.register('sync-new-posts');
      })
      .then(function () {
        return 'queued';
      })
      .catch(function (err) {
        // Sin permiso de Background Sync (p. ej. modo incógnito): se envía directo desde la página.
        console.warn('[Feed] Background Sync no disponible; se envía desde la página.', err);
        return sendData();
      });
  }
  return sendData();
}

window.addEventListener('online', sendData);

// Si quedaron posts pendientes (p. ej. el sync del Service Worker falló), enviarlos al cargar.
if (navigator.onLine) {
  sendData();
}

form.addEventListener('submit', function (event) {
  event.preventDefault();

  if (titleInput.value.trim() === '' || locationInput.value.trim() === '') {
    alert('Escribe un título y una ubicación.');
    return;
  }

  var post = {
    id: new Date().toISOString(),
    title: titleInput.value.trim(),
    location: locationInput.value.trim(),
    image: picture || DEFAULT_IMAGE
  };
  if (fetchedLocation) {
    post.rawLocation = fetchedLocation;
  }
  var submitButton = document.querySelector('#post-btn');
  submitButton.disabled = true;

  savePostForSync(post)
    .then(function () {
      return readAllData('posts');
    })
    .then(function (posts) {
      updateUI(posts);
      closeCreatePostModal();
      titleInput.value = '';
      locationInput.value = '';
      return registerPostSync()
        .then(function (synced) {
          if (synced === 'sent') {
            showPostMessage('Publicación publicada.');
          } else if (synced === 'queued') {
            showPostMessage('Publicación guardada; se sincronizará cuando haya conexión.');
          } else {
            showPostMessage('Publicación guardada en este dispositivo; se enviará al recuperar la conexión.');
          }
        })
        .catch(function (err) {
          console.warn('[Feed] Post is saved locally; background sync could not be scheduled.', err);
          showPostMessage('Publicación guardada en este dispositivo; se enviará al recuperar la conexión.');
        });
    })
    .catch(function (err) {
      console.error('[Feed] Could not save or queue the post.', err);
      showPostMessage('No se pudo guardar la publicación. Revisa el almacenamiento del navegador.');
    })
    .then(function () {
      submitButton.disabled = false;
    });
});
