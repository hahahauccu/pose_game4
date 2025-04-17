const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const poseImage = document.getElementById('poseImage');

let detector, rafId;
let currentPoseIndex = 0;
const totalPoses = 8;
const similarityThreshold = 0.85;
let standardKeypointsList = [];
let poseOrder = [];

// 隨機打亂 1~8
function shufflePoseOrder() {
  poseOrder = Array.from({ length: totalPoses }, (_, i) => i + 1);
  for (let i = poseOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [poseOrder[i], poseOrder[j]] = [poseOrder[j], poseOrder[i]];
  }
  console.log("✅ 本次動作順序：", poseOrder);
}

// 嘗試載入 png 或 PNG
async function resolvePoseImageName(base) {
  const png = `poses/${base}.png`;
  const PNG = `poses/${base}.PNG`;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(png);
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => resolve(PNG);
      img2.onerror = () => {
        console.error(`❌ 圖片找不到: poses/${base}.png 或 .PNG`);
        resolve(''); // 避免問號圖示
      };
      img2.src = PNG;
    };
    img.src = png;
  });
}

// 載入所有 JSON + 對應圖片
async function loadStandardKeypoints() {
  for (const i of poseOrder) {
    try {
      const res = await fetch(`poses/pose${i}.json`);
      const json = await res.json();
      const keypoints = json.keypoints || json;
      const imagePath = await resolvePoseImageName(`pose${i}`);
      standardKeypointsList.push({ id: i, keypoints, imagePath });
    } catch (err) {
      console.error(`❌ 載入 pose${i}.json 失敗`, err);
    }
  }
}

// 畫點
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

// 計算相似度
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
  return count === 0 ? 0 : 1 / (1 + (sum / count) / 100);
}

// 偵測主迴圈
async function detect() {
  const result = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const currentPose = standardKeypointsList[currentPoseIndex];
  if (currentPose) drawKeypoints(currentPose.keypoints, 'blue', 6, 0.5);

  if (result.length > 0) {
    const user = result[0].keypoints;
    drawKeypoints(user, 'red', 6, 1.0);
    const sim = compareKeypoints(user, currentPose.keypoints);
    if (sim > similarityThreshold) {
      currentPoseIndex++;
      if (currentPoseIndex < totalPoses) {
        poseImage.src = standardKeypointsList[currentPoseIndex].imagePath;
      } else {
        cancelAnimationFrame(rafId);
        alert('🎉 全部完成！');
        return;
      }
    }
  }

  rafId = requestAnimationFrame(detect);
}

// 啟動流程
async function startGame() {
  try {
    // ✅ 隱藏按鈕
    startBtn.style.display = 'none';
    startBtn.remove();

    shufflePoseOrder();

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: isMobile ? { ideal: 320 } : { ideal: 640 },
        height: isMobile ? { ideal: 240 } : { ideal: 480 }
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();

    // ✅ canvas 對齊解析度
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.style.width = `${video.videoWidth}px`;
    canvas.style.height = `${video.videoHeight}px`;

    // 選擇後端
    try {
      await tf.setBackend('webgl'); await tf.ready();
    } catch {
      try {
        await tf.setBackend('wasm'); await tf.ready();
      } catch {
        await tf.setBackend('cpu'); await tf.ready();
      }
    }

    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
    );

    await loadStandardKeypoints();

    if (!standardKeypointsList.length) {
      alert("❌ 沒有載入任何標準動作！");
      return;
    }

    poseImage.src = standardKeypointsList[0].imagePath;
    detect();

  } catch (err) {
    console.error('❌ 初始化失敗', err);
    alert('初始化失敗，請檢查相機權限或網路連線');
  }
}

startBtn.addEventListener("click", startGame);
