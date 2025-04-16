const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const poseImage = document.getElementById('poseImage');

let detector;
let currentPoseIndex = 0;
let standardKeypointsList = [];
let animationId;

const totalPoses = 8;
const similarityThreshold = 0.85;

// 载入标准姿势 JSON
async function loadStandardKeypoints() {
  for (let i = 1; i <= totalPoses; i++) {
    const res = await fetch(`poses/pose${i}.json`);
    const json = await res.json();
    standardKeypointsList.push(json);
  }
}

// 绘制一组关键点
function drawKeypoints(keypoints, color = 'red', radius = 5, alpha = 1.0) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  keypoints.forEach(kp => {
    if (kp.score > 0.4) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1.0;
}

// 计算两组关键点的相似度
function compareKeypoints(a, b) {
  let total = 0, count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i].score > 0.4 && b[i].score > 0.4) {
      const dx = a[i].x - b[i].x;
      const dy = a[i].y - b[i].y;
      total += Math.hypot(dx, dy);
      count++;
    }
  }
  if (count === 0) return 0;
  const avg = total / count;
  // 距离越小相似度越高，这里做简单反比映射
  return 1 / (1 + avg / 100);
}

// 主循环：绘制视频、玩家骨架、标准骨架并检测相似度
async function detect() {
  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // 先画标准骨架（底层，半透明蓝色）
  const target = standardKeypointsList[currentPoseIndex];
  drawKeypoints(target, 'blue', 6, 0.5);

  if (poses.length > 0) {
    const user = poses[0].keypoints;
    // 再画玩家骨架（红色）
    drawKeypoints(user, 'red', 6, 1.0);

    // 比对相似度
    const sim = compareKeypoints(user, target);
    if (sim > similarityThreshold) {
      currentPoseIndex++;
      if (currentPoseIndex < totalPoses) {
        poseImage.src = `poses/pose${currentPoseIndex + 1}.png`;
      } else {
        cancelAnimationFrame(animationId);
        alert('🎉 恭喜完成所有关卡！');
        return;
      }
    }
  }

  animationId = requestAnimationFrame(detect);
}

// 初始化并启动游戏
async function startGame() {
  startBtn.style.display = 'none';

  // 摄像头设置
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: 640, height: 480 },
    audio: false
  });
  video.srcObject = stream;
  await video.play();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // TF + MoveNet 加载
  await tf.setBackend('webgl');
  await tf.ready();
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );

  // 载入标准姿势并显示第一张
  await loadStandardKeypoints();
  poseImage.src = `poses/pose1.png`;

  // 进入检测循环
  detect();
}

startBtn.addEventListener('click', startGame);
