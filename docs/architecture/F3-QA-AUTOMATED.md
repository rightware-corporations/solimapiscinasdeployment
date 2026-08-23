# F3 Automated QA Result

**Tested commit:** `0364d9df3335c38bd8e46db2867aed62bb988088`  
**Runner:** GitHub Actions / Ubuntu / Node 22 / Playwright Chromium  
**Generated:** 2026-08-23T16:19:13Z

| Gate | Outcome |
|---|---|
| JavaScript syntax | success |
| Hardened backend regression | success |
| F3 hero capability/viewports | success |
| Existing visual QA normal | failure |
| Existing visual QA reduced | failure |
| Existing visual matrix merge | failure |

## Hero F3 summary

```json
{
  "total": 22,
  "passed": 22,
  "failed": 0,
  "failures": []
}
```

## Existing visual matrix summary

```json
{
  "normal": {
    "viewports": 15,
    "failures": [
      {
        "name": "844x390",
        "width": 844,
        "height": 390,
        "motion": "normal",
        "viewport": {
          "width": 844,
          "height": 390
        },
        "scrollY": 0,
        "navBox": {
          "left": 0,
          "top": 0,
          "right": 844,
          "bottom": 64,
          "width": 844,
          "height": 64
        },
        "titleBox": {
          "left": 179.28125,
          "top": 127.984375,
          "right": 664.703125,
          "bottom": 363.71875,
          "width": 485.421875,
          "height": 235.734375
        },
        "ctaBox": {
          "left": 213.546875,
          "top": 464.5,
          "right": 630.453125,
          "bottom": 508.5,
          "width": 416.90625,
          "height": 44
        },
        "horizontalOverflow": 0,
        "cueVisible": false,
        "cueOverlapsCtas": false,
        "cueGap": null,
        "ctaBottomSafe": false,
        "titleClearsNav": true,
        "touchCursorHidden": true,
        "metadataVisible": false,
        "metadataBox": null,
        "statBox": {
          "left": 505.125,
          "top": 246.7791748046875,
          "right": 765.125,
          "bottom": 358.2791748046875,
          "width": 260,
          "height": 111.5
        },
        "metadataOverlapsStat": false,
        "actionInsideCard": true,
        "actionRoundedBothSides": true,
        "desktopTwoColumns": true,
        "consentInsideCard": true,
        "consentControlBox": {
          "left": 164.53125,
          "top": 1070.421875,
          "right": 208.53125,
          "bottom": 1114.421875,
          "width": 44,
          "height": 44
        },
        "consentTouchTarget": true,
        "textClearsCardEdges": true,
        "submitInsideCard": true,
        "submitRoundedBothSides": true,
        "dialogCentered": true,
        "modalClosedBeforeContact": true,
        "consoleErrors": []
      }
    ]
  },
  "reduced": {
    "viewports": 15,
    "failures": [
      {
        "name": "844x390",
        "width": 844,
        "height": 390,
        "motion": "reduced",
        "viewport": {
          "width": 844,
          "height": 390
        },
        "scrollY": 0,
        "navBox": {
          "left": 0,
          "top": 0,
          "right": 844,
          "bottom": 64,
          "width": 844,
          "height": 64
        },
        "titleBox": {
          "left": 179.28125,
          "top": 127.984375,
          "right": 664.703125,
          "bottom": 363.71875,
          "width": 485.421875,
          "height": 235.734375
        },
        "ctaBox": {
          "left": 213.546875,
          "top": 464.5,
          "right": 630.453125,
          "bottom": 508.5,
          "width": 416.90625,
          "height": 44
        },
        "horizontalOverflow": 0,
        "cueVisible": false,
        "cueOverlapsCtas": false,
        "cueGap": null,
        "ctaBottomSafe": false,
        "titleClearsNav": true,
        "touchCursorHidden": true,
        "metadataVisible": false,
        "metadataBox": null,
        "statBox": {
          "left": 505.125,
          "top": 241.171875,
          "right": 765.125,
          "bottom": 352.671875,
          "width": 260,
          "height": 111.5
        },
        "metadataOverlapsStat": false,
        "actionInsideCard": true,
        "actionRoundedBothSides": true,
        "desktopTwoColumns": true,
        "consentInsideCard": true,
        "consentControlBox": {
          "left": 164.53125,
          "top": 1127.2232666015625,
          "right": 208.53125,
          "bottom": 1171.2232666015625,
          "width": 44,
          "height": 44
        },
        "consentTouchTarget": true,
        "textClearsCardEdges": true,
        "submitInsideCard": true,
        "submitRoundedBothSides": true,
        "dialogCentered": true,
        "modalClosedBeforeContact": true,
        "consoleErrors": []
      }
    ]
  }
}
```

This file is test evidence only. It does not deploy or change Railway.
