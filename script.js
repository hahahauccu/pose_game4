const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const poseImage = document.getElementById('poseImage');

let detector;
let currentPoseIndex = 0;
let standardKeypointsList = [];
let rafId;

const totalPoses = 8;
const similarityThreshold = 0.85;

// 载入标准姿势 JSON（假设每个 JSON 是一个对象 { keypoints: [...] } 或直接 [...])
async function loadStandardKeypoints() {
  for (let i = 1; i <= totalPoses; i++) {
    const res = await fetch(`poses/pose${i}.json`);
    const data = await res.json();
    const kps = Array.isArray(data)
      ? data
      : (data.keypoints || []);             // 处理两种格式
    console.log(`Loaded pose${i}.json, keypoints length:`, kps.length);
    standardKeypointsList.push(kps);
  }
}

// 通用的画点函数
function drawKeypoints(kps, color, radius, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (const kp of kps) {
    if (kp.score > 0.4) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;
}

// 计算相似度（距离越小越像）
function compareKeypoints(a, b) {
  let sum = 0, count = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i].score > 0.4 && b[i].score > 0.4) {
      const dx = a[i].x - b[i].x;
      const dy = a[i].y - b[i].y;
      sum += Math.hypot(dx, dy);
      count++;
    }
  }
  if (!count) return 0;
  const avg = sum / count;
  return 1 / (1 + avg / 100);
}

// 主循环：绘制视频、标准骨架、玩家骨架，并检测相似度
async function detect() {
  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // 画标准骨架（半透明蓝）
  const targetKps = standardKeypointsList[currentPoseIndex];
  if (targetKps) {
    drawKeypoints(targetKps, 'blue', 6, 0.5);
  }

  if (poses.length > 0) {
    const userKps = poses[0].keypoints;
    // 画玩家骨架（红）
    drawKeypoints(userKps, 'red', 6, 1.0);

    // 比对相似度
    const sim = compareKeypoints(userKps, targetKps);
    // console.log('similarity', sim);
    if (sim > similarityThreshold) {
      currentPoseIndex++;
      if (currentPoseIndex < totalPoses) {
        poseImage.src = `poses/pose${currentPoseIndex + 1}.png`;
      } else {
        cancelAnimationFrame(rafId);
        alert('🎉 全部完成！');
        return;
      }
    }
  }

  rafId = requestAnimationFrame(detect);
}

// 启动流程
async function startGame() {
  startBtn.style.display = 'none';

  // 摄像头
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 640, height: 480 },
    audio: false
  });
  video.srcObject = stream;
  await video.play();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // TF & 模型
  await tf.setBackend('webgl');
  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );

  // 载入标准姿势并显示第一张
  await loadStandardKeypoints();
  poseImage.src = `poses/pose1.png`;

  // 开始检测
  detect();
}

startBtn.addEventListener('click', startGame);
