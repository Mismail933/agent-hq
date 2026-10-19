"""Motion capture -> 2D poses for the story kit's people (2.55.0, the owner: "set up the animation first").

Real people's movement instead of hand-made sine swings: walks (normal, sad, scared, careful, exhausted, hurt leg), runs, a limp,
swimming, rowing, climbing a ladder, getting down and up, falling, sitting, waving, the phone, crying, cold, scared...

Source: the CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), free for research and commercial use, in Bruce Hahne's
BVH conversion (cgspeed.com; "I place no additional restrictions"), from github.com/una-dinosauria/cmu-mocap. CMU asks for the
line in CREDIT below. The BVH files (120 fps) live in ~/.agent-hq-anim/mocap/bvh (49 MB, not in the repo); this script turns the
clips in CLIPS into story/src/motions.js (angles only, a few hundred KB), which is in the repo.

How: forward kinematics of the BVH skeleton -> joint positions -> projected in the body's own frame (so a turning walk stays a
straight side view and the character walks on the spot; the scene moves it) -> per frame the angle of every limb segment from
straight down, in a SIDE view (forward = screen right) and a FRONT view (the character's left = screen right). Loops are cut at a
full stride (autocorrelation) and blended at the seam. Also: the hips' bob and the forward speed, in the kit's units (leg = 450).

    python mocap.py build            -> story/src/motions.js
    python mocap.py info <clip.bvh>  -> frames, length, joints
"""
import json
import sys
from pathlib import Path

import numpy as np

HOME = Path.home() / ".agent-hq-anim" / "mocap"
BVH = HOME / "bvh"
OUT = Path(__file__).resolve().parent / "story" / "src" / "motions.js"
FPS = 30
LEG = 450.0   # the kit's leg (hip to ankle) in Figure units
CREDIT = ("Motion capture: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), created with funding from NSF EIA-0196217; "
          "BVH conversion by Bruce Hahne.")

# name: (file, kind, start s, end s or None, note). kind loop = a stride cut and looped; once = played once, then held.
CLIPS = {
    "walk": ("91_29", "loop", 2.0, None, "normal walk"),
    "walk_brisk": ("82_12", "loop", 1.5, None, "happy / fast walk"),
    "walk_sad": ("91_13", "loop", 2.0, None, "sad walk"),
    "walk_tired": ("91_21", "loop", 2.0, None, "achey, exhausted walk"),
    "walk_scared": ("105_32", "once", 2.0, None, "scared walk"),
    "walk_careful": ("91_18", "loop", 2.0, None, "careful walk, looking around"),
    "limp": ("91_24", "loop", 2.0, None, "hurt leg"),
    "limp_drag": ("91_25", "loop", 2.0, None, "dragging a bad leg"),
    "run": ("127_03", "loop", 0.2, None, "run"),
    "run_careful": ("77_10", "loop", 1.0, None, "careful run"),
    "swim": ("79_02", "loop", 1.0, None, "swimming (mimed standing: crawl stroke)"),
    "row": ("79_95", "loop", 1.0, None, "rowing (mimed)"),
    "ladder": ("13_33", "once", 0.5, None, "climbing a ladder"),
    "lie_down": ("77_16", "once", 0.5, None, "lying down, getting up"),
    "fall": ("90_16", "once", 0.5, None, "falling on the face"),
    "sit_stand": ("13_01", "once", 0.5, None, "sitting on a stool, standing up"),
    "sit_ground": ("82_05", "once", 0.5, None, "sitting on the ground, relaxing"),
    "search": ("77_06", "once", 0.5, None, "searching the ground"),
    "drag": ("81_08", "once", 0.5, None, "dragging a heavy object"),
    "carry": ("69_69", "once", 0.5, None, "walking, picking up, carrying"),
    "wave": ("13_26", "once", 0.5, None, "waving, directing traffic"),
    "point": ("13_27", "once", 0.5, None, "waving and pointing"),
    "phone": ("79_36", "once", 0.5, None, "answering a phone"),
    "dial": ("79_37", "once", 0.5, None, "dialling a phone"),
    "sad": ("79_71", "once", 0.5, None, "sad"),
    "cry": ("79_72", "once", 0.5, None, "crying"),
    "scared": ("79_73", "once", 0.5, None, "scared"),
    "cold": ("79_68", "once", 0.5, None, "cold, shivering"),
    "face_in_hands": ("22_03", "once", 0.5, None, "sitting, face in hands"),
    "look_around": ("77_05", "once", 0.5, None, "looking around with a torch"),
    "handshake": ("79_06", "once", 0.5, None, "shaking hands"),
    "creep": ("77_14", "loop", 1.0, None, "careful creeping"),
}
ONCE_MAX_S = 12.0

# the segments the kit draws: (name, from joint, to joint)
SEGS = [("thighL", "LeftUpLeg", "LeftLeg"), ("shinL", "LeftLeg", "LeftFoot"), ("footL", "LeftFoot", "LeftToeBase"),
        ("thighR", "RightUpLeg", "RightLeg"), ("shinR", "RightLeg", "RightFoot"), ("footR", "RightFoot", "RightToeBase"),
        ("armL", "LeftArm", "LeftForeArm"), ("foreL", "LeftForeArm", "LeftHand"),
        ("armR", "RightArm", "RightForeArm"), ("foreR", "RightForeArm", "RightHand"),
        ("torso", "Hips", "Neck"), ("neck", "Neck", "Head")]
KEYS = [s[0] for s in SEGS]


def parse(path):
    toks = Path(path).read_text(encoding="utf-8", errors="replace").split()
    joints, stack, i, ch_total = [], [], 0, 0
    while toks[i] != "MOTION":
        t = toks[i]
        if t in ("ROOT", "JOINT"):
            joints.append({"name": toks[i + 1], "parent": stack[-1] if stack else -1, "offset": None, "ch": [], "ci": ch_total})
            i += 2
        elif t == "End":
            joints.append({"name": joints[stack[-1]]["name"] + "_end", "parent": stack[-1], "offset": None, "ch": [], "ci": ch_total})
            i += 2
        elif t == "{":
            stack.append(len(joints) - 1)
            i += 1
        elif t == "}":
            stack.pop()
            i += 1
        elif t == "OFFSET":
            joints[stack[-1]]["offset"] = np.array([float(x) for x in toks[i + 1:i + 4]])
            i += 4
        elif t == "CHANNELS":
            n = int(toks[i + 1])
            joints[stack[-1]]["ch"] = toks[i + 2:i + 2 + n]
            joints[stack[-1]]["ci"] = ch_total
            ch_total += n
            i += 2 + n
        else:
            i += 1
    nf = int(toks[toks.index("Frames:") + 1])
    ft = float(toks[toks.index("Time:", toks.index("Frames:")) + 1])
    k = toks.index("Time:", toks.index("Frames:")) + 2
    data = np.array(toks[k:k + nf * ch_total], dtype=float).reshape(nf, ch_total)
    return joints, data, ft


def _rot(axis, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    n = len(a)
    R = np.zeros((n, 3, 3))
    if axis == "X":
        R[:, 0, 0] = 1; R[:, 1, 1] = c; R[:, 1, 2] = -s; R[:, 2, 1] = s; R[:, 2, 2] = c
    elif axis == "Y":
        R[:, 1, 1] = 1; R[:, 0, 0] = c; R[:, 0, 2] = s; R[:, 2, 0] = -s; R[:, 2, 2] = c
    else:
        R[:, 2, 2] = 1; R[:, 0, 0] = c; R[:, 0, 1] = -s; R[:, 1, 0] = s; R[:, 1, 1] = c
    return R


def positions(joints, data):
    """World positions of every joint, every frame (N, J, 3)."""
    n = len(data)
    P = np.zeros((n, len(joints), 3))
    Rw = [None] * len(joints)
    for j, jt in enumerate(joints):
        R = np.tile(np.eye(3), (n, 1, 1))
        pos = np.tile(jt["offset"], (n, 1))
        for k, c in enumerate(jt["ch"]):
            col = data[:, jt["ci"] + k]
            if c.endswith("position"):
                pos[:, "XYZ".index(c[0])] = col + (jt["offset"]["XYZ".index(c[0])] if jt["parent"] >= 0 else 0)
            else:
                R = R @ _rot(c[0], col)
        if jt["parent"] < 0:
            Rw[j], P[:, j] = R, pos
        else:
            pr = Rw[jt["parent"]]
            P[:, j] = P[:, jt["parent"]] + np.einsum("nij,nj->ni", pr, pos)
            Rw[j] = pr @ R
    return P


def _smooth(x, k):
    k = max(1, int(k))
    ker = np.ones(k) / k
    pad = np.pad(x, ((k, k),) + ((0, 0),) * (x.ndim - 1), mode="edge")
    out = np.stack([np.convolve(pad[:, i], ker, mode="same") for i in range(x.shape[1])], 1) if x.ndim > 1 else np.convolve(pad, ker, "same")
    return out[k:-k]


def frames_of(path, start=0.0, end=None):
    joints, data, ft = parse(path)
    names = [j["name"] for j in joints]
    P = positions(joints, data)
    # 120 fps -> 30 fps, from start (frame 0 is the conversion's T-pose)
    step = max(1, round(1 / (ft * FPS)))
    a = max(1, int(start / ft))
    b = len(P) if end is None else min(len(P), int(end / ft))
    P = P[a:b:step]
    J = {n: P[:, i] for i, n in enumerate(names)}
    up = np.array([0.0, 1.0, 0.0])
    left = J["LeftUpLeg"] - J["RightUpLeg"]
    left[:, 1] = 0
    left = _smooth(left, FPS * 0.7)
    left /= np.linalg.norm(left, axis=1, keepdims=True) + 1e-9
    fwd = np.cross(left, up)
    leg = np.median(np.linalg.norm(J["LeftUpLeg"] - J["LeftLeg"], axis=1) + np.linalg.norm(J["LeftLeg"] - J["LeftFoot"], axis=1))
    out = {"side": {}, "front": {}}
    for key, a_, b_ in SEGS:
        d = J[b_] - J[a_]
        s, l, v = np.einsum("ni,ni->n", d, fwd), np.einsum("ni,ni->n", d, left), d[:, 1]
        down = -v
        if key in ("torso", "neck"):   # measured from straight UP (a lean forward is positive)
            out["side"][key] = np.degrees(np.arctan2(s, v))
            out["front"][key] = np.degrees(np.arctan2(l, v))
        else:
            out["side"][key] = np.degrees(np.arctan2(s, down))
            out["front"][key] = np.degrees(np.arctan2(l, down))
    hips = J["Hips"]
    stand = np.percentile(hips[:, 1], 90)
    out["bob"] = (hips[:, 1] - stand) / leg * LEG   # <= 0: the hips' drop below standing, in kit units
    disp = np.diff(hips, axis=0, prepend=hips[:1])
    out["speed"] = float(np.median(np.einsum("ni,ni->n", disp, fwd)) / leg * LEG)   # kit units per frame, forward
    # the lowest point of the body (feet, or hands/knees when on the ground) relative to the hips, so a crouch or a fall lands
    low = np.min(P[:, :, 1], axis=1)
    out["ground"] = (low - hips[:, 1]) / leg * LEG
    return out, len(P)


def _unwrap(a):
    return np.degrees(np.unwrap(np.radians(a)))


LEGS = ["thighL", "shinL", "thighR", "shinR"]
ARMS = ["armL", "foreL", "armR", "foreR"]
FOCUS = {"swim": ARMS, "row": ARMS}   # a mimed stroke: the arms carry the cycle; every walk and run: the legs


def loop_cut(m, hi=2.2, keys=None):
    """One full cycle (a stride, a stroke): the first autocorrelation peak after it has dipped below zero, of the main movement
    (the first principal component of every limb's angle, so a mimed swim is found by its arms). Then the cycle that repeats best
    (most like the one after it), so a stop, a turn or a stumble isn't the loop."""
    A = np.stack([_unwrap(m["side"][k]) for k in (keys or LEGS)], 1)
    A = A - A.mean(0)
    if len(A) > FPS * 4:   # without the slow drift (a turn, a change of pace): only the cycle
        A = A - _smooth(A, FPS * 1.6)
    u, s_, vt = np.linalg.svd(A, full_matrices=False)
    x = u[:, 0] * s_[0]
    n = len(x)
    ac = [1.0] + [np.dot(x[:-p], x[p:]) / (np.linalg.norm(x[:-p]) * np.linalg.norm(x[p:]) + 1e-9) for p in range(1, min(int(hi * FPS), n - 2))]
    per, best, dipped = None, -1.0, False
    for p in range(2, len(ac) - 1):
        dipped = dipped or ac[p] < 0
        if dipped and ac[p] >= ac[p - 1] and ac[p] >= ac[p + 1] and ac[p] > 0.1:
            per, best = p, ac[p]
            break
    if not per:   # too short for two cycles: the whole clip, blended at the seam
        return 0, n, 0.0
    starts = range(0, n - 2 * per) if n >= 2 * per + 1 else [0]
    s = min(starts, key=lambda i: float(np.mean((A[i:i + per] - A[i + per:i + 2 * per]) ** 2)) if n >= 2 * per + 1 else 0)
    return s, s + per, float(best)


def pack(m, a, b, loop):
    def cut(arr):
        seg = np.array(arr[a:b], dtype=float)
        if loop and len(seg) > 8:   # blend the seam: the last 6 frames move toward the first
            k = 6
            for i in range(k):
                w = (i + 1) / (k + 1)
                seg[-k + i] = seg[-k + i] * (1 - w) + arr[a + i - k] * w if a - k + i >= 0 else seg[-k + i]
        return seg
    rows = {}
    for view in ("side", "front"):
        cols = [np.round(cut(_unwrap(m[view][k]))).astype(int) for k in KEYS]
        rows[view] = np.stack(cols, 1).tolist()
    return {"side": rows["side"], "front": rows["front"], "bob": np.round(cut(m["bob"])).astype(int).tolist(),
            "ground": np.round(cut(m["ground"])).astype(int).tolist()}


def build():
    motions, report = {}, []
    for name, (fid, kind, start, end, note) in CLIPS.items():
        f = BVH / f"{fid}.bvh"
        if not f.exists():
            report.append(f"{name}: missing {f.name}")
            continue
        m, n = frames_of(f, start, end)
        if kind == "loop":
            a, b, q = loop_cut(m, keys=FOCUS.get(name))
            rep = f"{name}: loop of {b - a} frames ({(b - a) / FPS:.2f} s), match {q:.2f}"
        else:
            a, b = 0, min(n, int(ONCE_MAX_S * FPS))
            rep = f"{name}: {b - a} frames ({(b - a) / FPS:.1f} s)"
        d = pack(m, a, b, kind == "loop")
        d.update({"loop": kind == "loop", "speed": round(m["speed"], 2), "src": f"CMU {fid}", "note": note})
        motions[name] = d
        report.append(rep + f", speed {m['speed']:.2f}/frame")
    js = ("// written by mocap.py (2.55.0): real people's movement from the CMU Graphics Lab Motion Capture Database\n"
          "// (mocap.cs.cmu.edu, free for commercial use; BVH conversion by Bruce Hahne). Angles in degrees per frame at 30 fps,\n"
          f"// each limb from straight down (torso and neck from straight up). Columns: {', '.join(KEYS)}.\n"
          f"export const MOTION_KEYS = {json.dumps(KEYS)};\n"
          f"export const MOTIONS = {json.dumps(motions, separators=(',', ':'))};\n"
          f"export const MOTION_CREDIT = {json.dumps(CREDIT)};\n")
    OUT.write_text(js, encoding="utf-8")
    print("\n".join(report))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "build":
        build()
    elif len(sys.argv) > 2 and sys.argv[1] == "info":
        j, d, ft = parse(sys.argv[2])
        print(len(d), "frames,", round(len(d) * ft, 1), "s,", len(j), "joints")
    else:
        print(__doc__)
