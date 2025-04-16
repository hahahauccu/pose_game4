const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const poseImage = document.getElementById('poseImage');

let detector;
let currentPoseIndex = 0;
let standardKeypointsList = [];
let animationFrameId;

const totalPoses = 8;
const similarityThreshold = 0.85;

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });
  video.srcObject = stream;
  return new Promise(resolve => {
    video.onloadedmetadata = () => resolve(video);
  });
}

async function loadStandardKeypoints() {
  for (let i = 1; i <= totalPoses; i++) {
    const res = await fetch(`poses/pose${i}.json`);
    const json = await res.json();
    standardKeypointsList.push(json);
  }
}

function drawKeypoints(keypoints, color = "red") {
  keypoints.forEach(kp => {
    if (kp.score > 0.4) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
  });
}

function compareKeypoints(a, b) {
  let total = 0;
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i].score > 0.4 && b[i].score > 0.4) {
      const dx = a[i].x - b[i].x;
      const dy = a[i].y - b[i].y;
      total += Math.sqrt(dx * dx + dy * dy);
      count++;
    }
  }
  if (count === 0) return 0;
  const avgDist = total / count;
  const normalized = 1 / (1 + avgDist / 100);
  return normalized;
}

async function detect() {
  animationFrameId = requestAnimationFrame(detect);
  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (poses.length > 0) {
    const keypoints = poses[0].keypoints;
    drawKeypoints(keypoints, "red");
    const target = standardKeypointsList[currentPoseIndex];
    drawKeypoints(target, "lime");

    const similarity = compareKeypoints(keypoints, target);
    if (similarity > similarityThreshold) {
      currentPoseIndex++;
      if (currentPoseIndex < totalPoses) {
        updatePoseImage();
      } else {
        cancelAnimationFrame(animationFrameId);
        alert("🎉 恭喜完成所有關卡！");
      }
    }
  }
}

function updatePoseImage() {
  poseImage.src = `poses/pose${currentPoseIndex + 1}.png`;
}

async function startGame() {
  startBtn.style.display = "none";
  await setupCamera();
  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  await tf.setBackend('webgl');
  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );
  await loadStandardKeypoints();
  updatePoseImage();
  detect();
}

startBtn.addEventListener("click", startGame);
