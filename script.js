const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const poseImage = document.getElementById('poseImage');

let detector, rafId;
let currentPoseIndex = 0;
const totalPoses = 8;
const similarityThreshold = 0.85;
const standardKeypointsList = [];

// 载入标准姿势
async function loadStandardKeypoints() {
  for (let i = 1; i <= totalPoses; i++) {
    const res = await fetch(`poses/pose${i}.json`);
    const data = await res.json();
    standardKeypointsList.push(data.keypoints || data);
  }
}

// 绘制关键点
function drawKeypoints(kps, color, radius, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  kps.forEach(kp => {
    if (kp.score > 0.4) {
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1.0;
}

// 计算相似度
function compareKeypoints(a, b) {
  let sum=0, cnt=0;
  for (let i=0;i<a.length && i<b.length;i++) {
    if(a[i].score>0.4 && b[i].score>0.4) {
      const dx = a[i].x - b[i].x;
      const dy = a[i].y - b[i].y;
      sum += Math.hypot(dx,dy);
      cnt++;
    }
  }
  if(cnt===0) return 0;
  const avg = sum/cnt;
  return 1/(1 + avg/100);
}

// 主循环
async function detect() {
  const res = await detector.estimatePoses(video);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(video,0,0,canvas.width,canvas.height);

  // 画标准骨架（蓝色半透明）
  const target = standardKeypointsList[currentPoseIndex];
  if(target) drawKeypoints(target,'blue',6,0.5);

  if(res.length>0) {
    const user = res[0].keypoints;
    drawKeypoints(user,'red',6,1.0);
    const sim = compareKeypoints(user,target);
    if(sim > similarityThreshold) {
      currentPoseIndex++;
      if(currentPoseIndex<totalPoses) {
        poseImage.src = `poses/pose${currentPoseIndex+1}.png`;
      } else {
        cancelAnimationFrame(rafId);
        alert('🎉 全部完成！');
        return;
      }
    }
  }
  rafId = requestAnimationFrame(detect);
}

// 初始化游戏：尝试多后端并降分辨率
async function startGame() {
  startBtn.disabled = true;

  // 手机上降分辨率
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const constraints = {
    video: {
      facingMode: 'user',
      width: isMobile ? { ideal: 320 } : { ideal: 640 },
      height: isMobile ? { ideal: 240 } : { ideal: 480 }
    },
    audio: false
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  await video.play();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // 先尝试 WebGL，再回退到 WASM，最后 CPU
  let chosenBackend = null;
  try {
    await tf.setBackend('webgl'); await tf.ready();
    chosenBackend = 'webgl';
  } catch(e1) {
    console.warn('WebGL 不可用，尝试 WASM', e1);
    try {
      await tf.setBackend('wasm'); await tf.ready();
      chosenBackend = 'wasm';
    } catch(e2) {
      console.warn('WASM 不可用，使用 CPU', e2);
      await tf.setBackend('cpu'); await tf.ready();
      chosenBackend = 'cpu';
    }
  }
  console.log('使用后端：', chosenBackend);

  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );

  await loadStandardKeypoints();
  poseImage.src = `poses/pose1.png`;

  detect();
}

startBtn.addEventListener('click', startGame);
