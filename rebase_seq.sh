#!/bin/bash
cat << 'SEQ' > "$1"
pick a7f6c40 fix(ui): fix document swap button click interception and event bubbling
fixup 112e930 fix(ui): correct z-index click interception on swap button by adding relative class to Slot 1
pick a9becbd feat(ui): adjust auto-scroll offset in pdf viewer to keep document header visible
pick a6812aa feat(ui): add language selector to speech dictation modal supporting uk-UA, ru-RU, en-US
pick 5d8f9dc feat(ai): integrate dynamic LLM evaluation for executive directives in UI and audit reports
fixup df83c60 feat(ai): evaluate executive directive dynamically via LLM and display response in UI
fixup c7bbb4a fix(ui): use neutral indigo colors for executive directive block
fixup 1852c67 fix(ai): prevent AI from echoing user directive in response
pick 74b2a8a refactor(ui): remove placeholder russian subtitles from analysis stepper
fixup 9b73707 fix(type): remove subtitle from StepInfo interface to fix build
SEQ
