document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('gallery');
    const uploadImage = document.getElementById('upload-image');
    const result = document.getElementById('result');
    const openCameraRear = document.getElementById('open-camera-rear');
    const openCameraFront = document.getElementById('open-camera-front');
    const video = document.getElementById('video');
    const captureButton = document.getElementById('capture');

    let galleryImages = [];

    // Charger dynamiquement les images de la galerie depuis le fichier JSON
    fetch('images.json')
        .then(response => response.json())
        .then(images => {
            galleryImages = images;
            images.forEach(image => {
                const img = new Image();
                img.src = image.path;
                img.alt = image.name;
                img.dataset.name = image.name;
                img.onload = () => gallery.appendChild(img);
            });
        })
        .catch(error => console.error('Erreur lors du chargement des images:', error));

    uploadImage.addEventListener('change', handleImageUpload);

    openCameraRear.addEventListener('click', () => {
        openCamera({ video: { facingMode: { exact: "environment" } } });
    });

    openCameraFront.addEventListener('click', () => {
        openCamera({ video: { facingMode: "user" } });
    });

    function openCamera(constraints) {
        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                video.srcObject = stream;
                video.style.display = 'block';
                captureButton.style.display = 'block';
            })
            .catch(error => console.error('Erreur lors de l\'accès à la caméra:', error));
    }

    captureButton.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.src = canvas.toDataURL('image/png');
        img.onload = function() {
            compareImages(img);
            video.style.display = 'none';
            captureButton.style.display = 'none';
            // Arrêter le flux de la caméra
            const stream = video.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
        };
    });

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.src = e.target.result;
                img.onload = function() {
                    compareImages(img);
                };
            };
            reader.readAsDataURL(file);
        }
    }

    function compareImages(uploadedImage) {
        const colorThief = new ColorThief();
        const uploadedImageColor = colorThief.getColor(uploadedImage);

        let closestImage = null;
        let closestImages = [];
        let minDistance = Infinity;

        gallery.querySelectorAll('img').forEach(galleryImage => {
            const galleryImageColor = colorThief.getColor(galleryImage);
            const distance = getColorDistance(uploadedImageColor, galleryImageColor);

            if (distance < minDistance) {
                minDistance = distance;
                closestImage = galleryImage;
            }
            closestImages.push({ image: galleryImage, distance: distance });
        });

        // Trier les images par distance
        closestImages.sort((a, b) => a.distance - b.distance);

        // Vérifiez si l'image la plus proche est identique à 99% en couleur
        let exactMatchImages = [];
        if (minDistance < 2.5) {  // Utiliser une petite valeur pour approximer 99% de similitude
            exactMatchImages.push(closestImage);
        }

        // Filtrer les images en fonction des veines détectées
        const filteredImages = closestImages.filter(img => {
            return detectVeins(uploadedImage, img.image);
        });

        displayResult(exactMatchImages, filteredImages.slice(0, 5).map(img => img.image)); // Afficher les 5 images les plus proches
    }

    function getColorDistance(color1, color2) {
        return Math.sqrt(
            Math.pow(color1[0] - color2[0], 2) +
            Math.pow(color1[1] - color2[1], 2) +
            Math.pow(color1[2] - color2[2], 2)
        );
    }

    function detectVeins(image1, image2) {
        // Utiliser OpenCV pour détecter les veines
        let src1 = cv.imread(image1);
        let src2 = cv.imread(image2);

        // Redimensionner les images pour qu'elles aient la même taille
        if (src1.size().width !== src2.size().width || src1.size().height !== src2.size().height) {
            cv.resize(src2, src2, new cv.Size(src1.size().width, src1.size().height));
        }

        cv.cvtColor(src1, src1, cv.COLOR_RGBA2GRAY, 0);
        cv.cvtColor(src2, src2, cv.COLOR_RGBA2GRAY, 0);

        // Utiliser l'algorithme de détection de contours de Canny pour détecter les veines
        cv.Canny(src1, src1, 50, 100, 3, false);
        cv.Canny(src2, src2, 50, 100, 3, false);

        // Calculer la différence entre les images de contours
        let diff = new cv.Mat();
        cv.absdiff(src1, src2, diff);

        // Calculer la somme des différences
        let sum = 0;
        for (let i = 0; i < diff.rows; i++) {
            for (let j = 0; j < diff.cols; j++) {
                sum += diff.ucharPtr(i, j)[0];
            }
        }

        src1.delete();
        src2.delete();
        diff.delete();

        // Si la somme des différences est inférieure à un seuil, considérer les veines comme similaires
        return sum < 100000;  // Ajustez le seuil selon vos besoins
    }

    function displayResult(exactMatchImages, similarImages) {
        result.innerHTML = '';

        if (exactMatchImages.length > 0) {
            const title = document.createElement('h2');
            title.textContent = 'Carreau Identique Trouvé';
            result.appendChild(title);

            exactMatchImages.forEach(image => {
                const img = document.createElement('img');
                img.src = image.src;
                img.alt = image.alt;
                const imageName = document.createElement('div');
                imageName.classList.add('image-name');
                imageName.textContent = image.dataset.name;
                result.appendChild(img);
                result.appendChild(imageName);
            });
        }

        if (similarImages.length > 0) {
            const title = document.createElement('h2');
            title.textContent = 'Carreaux Similaires Trouvés';
            result.appendChild(title);

            similarImages.forEach(image => {
                const img = document.createElement('img');
                img.src = image.src;
                img.alt = image.alt;
                const imageName = document.createElement('div');
                imageName.classList.add('image-name');
                imageName.textContent = image.dataset.name;
                result.appendChild(img);
                result.appendChild(imageName);
            });
        }

        if (exactMatchImages.length === 0 && similarImages.length === 0) {
            const message = document.createElement('div');
            message.textContent = 'Pas de carreau trouvé';
            message.style.color = 'red';
            result.appendChild(message);
        }
    }
});
