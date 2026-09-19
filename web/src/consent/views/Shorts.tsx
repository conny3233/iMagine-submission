import { useEffect, useRef, useState } from "react";

import { assetUrl } from "../../lib/paths";

/**
 * 오답 뒤 재설명 화면에 붙는 세로 영상 (콘텐츠의 remedialVideo).
 * 소리 켜고 바로 재생을 시도하고, 브라우저가 막으면 소리 없이 재생하면서 "소리 켜기"를 띄운다.
 * 파일이 없거나 못 틀면 아무것도 그리지 않는다 — 영상 파일만 넣으면 나오도록 미리 연결해 둔 것.
 */
export default function Shorts({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      video.play().catch(() => {}); // 이것도 막히면 컨트롤의 재생 버튼으로 튼다
    });
  }, [src]);

  if (failed) return null;

  return (
    <div className="d-shorts">
      <video
        ref={ref}
        src={assetUrl(src)}
        playsInline
        controls
        preload="auto"
        onError={() => setFailed(true)}
      />
      {muted && (
        <button
          type="button"
          className="d-shorts-sound"
          onClick={() => {
            const video = ref.current;
            if (!video) return;
            video.muted = false;
            setMuted(false);
            void video.play().catch(() => {});
          }}
        >
          소리 켜기
        </button>
      )}
    </div>
  );
}
