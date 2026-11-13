// 由 tools/sync_actions.py 生成，不要手改。
// 每组动作的帧数 / 网格 / 尺寸都从图集实测得出，app.js 只消费这份数据。
window.BURST_SETS = [
  {
    "id": "impact-pose",
    "action": "impact",
    "variant": "姿态帧",
    "kind": "pose",
    "total": 10
  },
  {
    "id": "walk",
    "action": "walk",
    "kind": "sheet",
    "sheet": "assets/burst/walk.webp",
    "cols": 4,
    "rows": 2,
    "total": 8,
    "ar": 1.0
  },
  {
    "id": "wave",
    "action": "wave",
    "kind": "sheet",
    "sheet": "assets/burst/wave.webp",
    "cols": 4,
    "rows": 2,
    "total": 8,
    "ar": 1.0
  },
  {
    "id": "jump",
    "action": "jump",
    "kind": "sheet",
    "sheet": "assets/burst/jump.webp",
    "cols": 4,
    "rows": 2,
    "total": 8,
    "ar": 1.0
  },
  {
    "id": "sit",
    "action": "sit",
    "kind": "sheet",
    "sheet": "assets/burst/sit.webp",
    "cols": 4,
    "rows": 2,
    "total": 8,
    "ar": 1.0
  },
  {
    "id": "fall",
    "action": "fall",
    "kind": "sheet",
    "sheet": "assets/burst/fall.webp",
    "cols": 4,
    "rows": 2,
    "total": 8,
    "ar": 1.0
  },
  {
    "id": "combo",
    "action": "combo",
    "variant": "连招",
    "kind": "combo",
    "total": 40
  }
];

// 人物卡：撞墙姿态帧的底图，点一张换一套造型
window.BURST_CARDS = [
  {
    "id": "card-1",
    "label": "微澜",
    "sheet": "assets/burst/card-1.webp",
    "ar": 0.5669
  },
  {
    "id": "card-2",
    "label": "丰满",
    "sheet": "assets/burst/card-2.webp",
    "ar": 0.5669
  },
  {
    "id": "card-3",
    "label": "汹涌",
    "sheet": "assets/burst/card-3.webp",
    "ar": 0.5669
  }
];
