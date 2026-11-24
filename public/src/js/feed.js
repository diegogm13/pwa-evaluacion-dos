var shareImageButton = document.querySelector('#share-image-button');
var createPostArea = document.querySelector('#create-post');
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
var sharedMomentsArea = document.querySelector('#shared-moments');
var form = document.querySelector('form');
var titleInput = document.querySelector('#title');
var locationInput = document.querySelector('#location');


function openCreatePostModal() {
  // createPostArea.style.display = 'block';

  createPostArea.style.transform = 'translateY(0)';
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
          return deleteItemFromData('sync-posts', post.id);
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
    alert('Please enter valid data!');
    return;
  }

  var post = {
    id: new Date().toISOString(),
    title: titleInput.value.trim(),
    location: locationInput.value.trim(),
    image: 'https://firebasestorage.googleapis.com/v0/b/proyeto-del-curso.firebasestorage.app/o/sf-boat.jpg?alt=media&token=1c264061-7918-4a64-b15e-d14f8d7ed95f'
  };
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
