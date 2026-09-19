// 화면 설정값 — 여러 화면이 같이 쓴다.

import { assetUrl } from "../lib/paths";
import type { ExplanationMode } from "./flow/machine";

export type ReadStyle = ExplanationMode["style"]; // "detailed" = 피그마의 hard(원문), "easy" = 쉬운 설명 카드

/** 글자 크기 슬라이더 칸 수. LARGE_TEXT_FROM 칸 이상이면 영수증에 "큰 글씨"로 남긴다. */
export const TEXT_STEPS = 5;
export const LARGE_TEXT_FROM = 2;

/** iMprint(앱 ②) 주소 — 같은 배포 안의 다른 페이지다. */
export const IMPRINT_URL = assetUrl("/vault.html");
