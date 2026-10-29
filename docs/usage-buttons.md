# Every button, grouped by tool (ML-22)

**Made by `node scripts/usage-buttons.mjs` - don't edit it by hand.** What counts as a use, and how a tap is
counted, is in [usage-stats.md](usage-stats.md) ("Every button").

912 buttons: 912 have a name a tap can be counted by, 0 need one.
A button on a screen is listed under the screen or pop-up it is on; one the app builds as it goes, under
the function that builds it (shown with ()). The words are only to help find it - a tap is never counted by
its words.

| Tool | Buttons | Need a name |
|---|---|---|
| Practice session | 87 | 0 |
| Metronome (Quick Play) | 46 | 0 |
| Tuner | 11 | 0 |
| Tuning fork | 7 | 0 |
| Timer | 13 | 0 |
| Warm-ups | 38 | 0 |
| Scales | 50 | 0 |
| Theory | 25 | 0 |
| Skills: Tempo, Pulse, Pitch, Rhythm | 38 | 0 |
| Range | 14 | 0 |
| Pieces: Rehearse, play, edit | 268 | 0 |
| Add a piece | 8 | 0 |
| Recordings | 6 | 0 |
| Practice lists | 16 | 0 |
| Home and All tools | 21 | 0 |
| Stats | 25 | 0 |
| Instrument support | 11 | 0 |
| Set-up | 10 | 0 |
| My bands | 31 | 0 |
| My account, instruments, settings | 57 | 0 |
| Signing in | 15 | 0 |
| Menu, notices and the rest | 115 | 0 |

## Practice session

| Where | Counted as | Words on it |
|---|---|---|
| top bar | `#sessionBar` | Block 1 of 1 5:00 |
| sessionLengthView | `#sessSameBtn` | Same as last time |
| sessionLengthView | `#sessLenMinus` | 5 minutes less |
| sessionLengthView | `#sessLenPlus` | + |
| sessionLengthView | `#sessToPlanBtn` | Next: what kind of practice |
| sessionPickView | `data-step-back=sessionLengthView` | How long |
| sessionPickView | `#sessPlanBtn` | Standard plan |
| sessionPickView | `#sessToContentBtn` | Next: what's in it |
| sessionBuildView | `#sessBuildSurpriseBtn` | Surprise me |
| sessionBuildView | `#sessBuildClearBtn` | Clear |
| sessionBuildView | `#sessBuildSaveBtn` | Save my plan and use it |
| sessionBuildView | `#sessBuildDeleteBtn` | Delete this plan |
| sessionContentView | `data-step-back=sessionLengthView` | How long |
| sessionContentView | `data-step-back=sessionPickView` | What kind |
| sessionContentView | `#sessToReadyBtn` | Ready! See my session |
| sessionPlanView | `#sessStartBtn` | Start |
| sessionRunView | `#sessRunGoBtn` | Start this block |
| sessionRunView | `#sessRunNextBtn` | Next block |
| sessionRunView | `#sessRunEndBtn` | End the session now |
| sessionRunView | `#sessRunDoneBtn` | Done |
| piecePathView | `#pathMovementBtn` | all movement |
| piecePathView | `#pathBarByBarBtn` | Bar by bar |
| piecePathView | `#pathGoBtn` | Start preparing |
| piecePathView | `#pathSkipBtn` | Skip play through and set the level directly |
| piecePathView | `#pathPaintBtn` | Set the levels again |
| piecePathView | `#pathCutBtn` | Focus sections |
| prepareRunView | `#prepCountInBtn` | 1 bar count-in before it starts |
| prepareRunView | `#prepPlayBtn` | Play it through |
| prepareRunView | `#prepSkipBtn` | Skip play through and set the level directly |
| levelsPaintView | `#paintTypeBtn` | Type bars instead |
| levelsPaintView | `data-paint-tool=brush` | Fill bar |
| levelsPaintView | `data-paint-tool=section` | Fill section |
| levelsPaintView | `data-paint-tool=all` | Fill all |
| levelsPaintView | `data-paint-tool=range` | Range |
| levelsPaintView | `data-paint-tool=rubber` | Remove level |
| levelsPaintView | `#paintUndoBtn` | Undo |
| levelsPaintView | `#paintNextBtn` | Next: split into focus sections |
| levelsCutView | `#cutTypeBtn` | Type bars instead |
| levelsCutView | `#cutDoneBtn` | Done preparing |
| sessTimeUpModal | `#sessTimeUpFinishBtn` | Finish the session |
| sessTimeUpModal | `#sessTimeUpExtendBtn` | Just another 5 minutes |
| scaleUpModal | `close (X)` | Close |
| scaleUpModal | `#scaleUpOkBtn` | Carry on |
| sessPlanModal | `close (X)` | Close |
| sessPlanModal | `#sessPlanNewBtn` | + New plan |
| sessPlanModal | `#sessPlanUseBtn` | Use this plan |
| sessPlanModal | `#sessPlanMenuChange` | Change |
| sessPlanModal | `#sessPlanMenuDelete` | Delete |
| skillRateModal | `#skillRateCloseBtn` | Close without saying |
| skillRateModal | `#skillRateYesBtn` | Got it - next step |
| skillRateModal | `#skillRateNoBtn` | Not yet Same step next time |
| paintTypeModal | `#paintTypeCloseBtn` | Close |
| paintTypeModal | `#paintTypeDoneBtn` | Set these bars |
| cutTypeModal | `#cutTypeCloseBtn` | Close |
| cutTypeModal | `#cutTypeDoneBtn` | Make it a focus section |
| sessPiecesModal | `#sessPiecesCloseBtn` | Close |
| sessPiecesModal | `#sessPiecesDoneBtn` | Use these pieces |
| plOwnerModal | `#plOwnerCloseBtn` | Close |
| plDateModal | `#plDateCloseBtn` | Close |
| plDateModal | `#plDateNoneBtn` | No target date Just show how many blocks it takes |
| plDateModal | `#plDateSetBtn` | Pick a date See the pace that gets you there |
| plDateModal | `#plDateDoneBtn` | Done |
| plPiecesModal | `#plPiecesCloseBtn` | Close |
| plPiecesModal | `#plPiecesDoneBtn` | Add |
| sessPiecesBlockModal | `close (X)` | Close |
| sessPiecesBlockModal | `#sessPiecesSourceBtn` | All my pieces with Levels where the pieces come from |
| sessPiecesBlockModal | `#sessPiecesBlockDoneBtn` | Done |
| sessScalesBlockModal | `close (X)` | Close |
| sessScalesBlockModal | `#sessScalesBlockDoneBtn` | Done |
| sessionBlockModal | `#sessionBlockCloseBtn` | Close |
| top bar | `#sessionHistoryItemEdit` | Edit |
| top bar | `#sessionHistoryItemDelete` | Delete |
| renderPrepareList() | `data-prepare-id` |  |
| renderPathThrough() | `data-through` |  |
| paintBarHtml() | `data-bar` |  |
| renderPaint() | `data-pot` |  |
| renderPaintTypePicker() | `data-level` |  |
| renderCut() | `data-split` | Split it for me |
| openLevelRating() | `data-rate` |  |
| openLevelRating() | `data-rate` | Too fast? Back to Level … |
| openLevelRating() | `data-rate` |  |
| renderPlanPick() | `data-plan` |  |
| renderPlanPick() | `data-plan-menu` |  |
| renderSessScales() | `data-scales-all` | See all my scales |
| sessContentRowHtml() | `data-content` |  |
| renderSessionPlan() | `data-block` |  |
| openSessionBlockModal() | `data-opt` |  |

## Metronome (Quick Play)

| Where | Counted as | Words on it |
|---|---|---|
| quickPlayView | `#qpVolumeBtn` | Volume - tap to change |
| quickPlayView | `#qpPlayBtn` | play |
| quickPlayView | `#qpResetBtn` | reset |
| quickPlayView | `#qpSubdivideBtn` | 1 sub beats |
| quickPlayView | `#qpSpeedBtn` | 100% play speed |
| quickPlayView | `#qpLoadedHistoryUndoBtn` | Revert to the loaded version |
| quickPlayView | `#qpLoadedHistoryClearBtn` | Clear loaded history and reset |
| quickPlayView | `#qpAddBlockBtn` | + Add bar |
| quickPlayView | `#qpBarMenuMoveUp` | Move up |
| quickPlayView | `#qpBarMenuMoveDown` | Move down |
| quickPlayView | `#qpBarMenuDuplicate` | Duplicate |
| quickPlayView | `#qpBarMenuDelete` | Delete |
| quickPlayView | `#qpBarMenuResetAll` | Delete all and reset |
| qpSubdivideModal | `hide-modal(qpSubdivideModal)` | Close |
| qpSubdivideModal | `#qpSubdivideMinus` | Decrease sub beats |
| qpSubdivideModal | `#qpSubdividePlus` | + |
| qpSubdivideModal | `#qpSubdivideCancelBtn` | Cancel |
| qpSubdivideModal | `#qpSubdivideSaveBtn` | Save |
| qpSpeedModal | `hide-modal(qpSpeedModal)` | Close |
| qpVolumeModal | `#qpVolumeCloseBtn` | Close |
| qpVolumeModal | `#qpVolumeMinus` | Decrease volume |
| qpVolumeModal | `#qpVolumePlus` | + |
| qpVolumeModal | `#qpMuteBtn` | Mute |
| qpHistoryModal | `close (X)` | Close |
| qpHistoryModal | `#qpHistoryCloseBtn` | Close |
| qpHistoryModal | `#qpHistoryLoadBtn` | Load |
| qpMergeBarsModal | `close (X)` | Close |
| qpMergeBarsModal | `#qpMergeBarsCancelBtn` | Cancel |
| qpMergeBarsModal | `#qpMergeBarsSaveBtn` | Save to flow |
| top bar | `#qpHistoryItemRename` | Rename |
| top bar | `#qpHistoryItemDuplicate` | Duplicate |
| top bar | `#qpHistoryItemFavoriteToggle` | Set as favourite |
| top bar | `#qpHistoryItemDelete` | Delete |
| qpBlockBoxHtml() | `data-qp-grab-handle` |  |
| qpBlockBoxHtml() | `data-qp-menu-btn` |  |
| qpBlockBoxHtml() | `data-qp-timesig-btn` | … time |
| qpBlockBoxHtml() | `data-qp-note-btn` | … beat note |
| qpBlockBoxHtml() | `data-qp-bpm-minus` | Decrease beats per minute |
| qpBlockBoxHtml() | `data-qp-bpm-plus` | + |
| qpOpenNotePicker() | `data-note` |  |
| renderQpMergeGroupHtml() | `data-qp-merge-split` |  |
| renderQpMergeGroupHtml() | `data-qp-merge-toggle-menu` |  |
| renderQpMergeGroupHtml() | `data-qp-merge-into` | Merge above |
| renderQpMergeGroupHtml() | `data-qp-merge-into` | Merge below |
| renderQpHistoryList() | `data-qp-history-menu-btn` |  |
| loadQuickPlayPlaybackSpeeds() | `data-value` | …% |

## Tuner

| Where | Counted as | Words on it |
|---|---|---|
| tunerView | `#tunerSettingsBtn` | Tuner settings |
| tunerView | `#tunerRetryBtn` | Try again |
| tunerView | `#tunerPauseBtn` | Pause history |
| tunerSettingsModal | `#tunerSettingsCloseBtn` | Close |
| tunerSettingsModal | `#tunerTranspositionBtn` | Transposition C |
| tunerSettingsModal | `#tunerANBtn` | Tuning reference (A4) 440Hz |
| tunerTranspositionModal | `#tunerTranspositionCloseBtn` | Close |
| tunerA4Modal | `#tunerANCloseBtn` | Close |
| tunerA4Modal | `#tunerANMinus` | Decrease A4 reference |
| tunerA4Modal | `#tunerANPlus` | + |
| tunerA4Modal | `#tunerANResetBtn` | Reset to 440Hz |

## Tuning fork

| Where | Counted as | Words on it |
|---|---|---|
| tuningForkView | `#forkStave` | Tuning note - tap the stave near a note to pick it |
| tuningForkView | `#forkMinus` | A semitone lower |
| tuningForkView | `#forkPlus` | + |
| tuningForkView | `#forkInstrumentBtn` | instrument |
| tuningForkView | `#forkPlayBtn` | play |
| tuningForkView | `#forkMuteBtn` | Mute |
| tuningForkView | `#forkUsualBtn` | Back to the usual tuning note |

## Timer

| Where | Counted as | Words on it |
|---|---|---|
| top bar | `#timerInlineCloseBtn` | Close |
| top bar | `#timerInlinePickBtn` | Pick minutes |
| top bar | `#timerInlinePlayBtn` | start |
| top bar | `#timerInlineStopBtn` | stop |
| timerView | `#timerStartBtn` | Start |
| timerView | `#timerPlayBtn` | Pause |
| timerView | `#timerStopBtn` | Stop |
| timerDurationPickerModal | `#timerDurationPickerXBtn` | Close |
| timerDurationPickerModal | `#timerDurationPickerCancelBtn` | Cancel |
| timerDurationPickerModal | `#timerDurationPickerSaveBtn` | Save |
| timerFinishedModal | `#timerFinishedYesBtn` | Yes, save it |
| timerFinishedModal | `#timerFinishedExtendBtn` | Just another 5 minutes |
| timerFinishedModal | `#timerFinishedNoBtn` | No |

## Warm-ups

| Where | Counted as | Words on it |
|---|---|---|
| warmupsSettingsModal | `data-modal-close` | Close |
| warmupsSettingsModal | `#warmupsInstrumentBtn` | - instrument |
| warmupsSettingsModal | `#warmupsClefBtn` | Treble clef |
| warmupsSettingsModal | `#warmupsTopicsBtn` | All topics |
| warmupsSettingsModal | `#warmupsSizeBtn` | Medium music size |
| warmupsSettingsModal | `#warmupsSeeRangeBtn` | See your range |
| warmupsSettingsModal | `#warmupsSpeedBtn` | Their own speed |
| warmupsSettingsModal | `#warmupsRepeatBtn` | Twice play each one |
| warmupsSettingsModal | `#warmupsCountInBtn` | 1 bar count-in |
| warmupsSettingsModal | `#warmupsVolumeBtn` | 80% volume |
| warmupsSettingsModal | `data-modal-close` | Done |
| warmupsInstrumentModal | `data-modal-close` | Close |
| warmupsTopicsModal | `data-modal-close` | Close |
| warmupsTopicsModal | `data-modal-close` | Done |
| warmupsClefModal | `data-modal-close` | Close |
| warmupsSizeModal | `data-modal-close` | Close |
| warmupsSpeedModal | `data-modal-close` | Close |
| warmupsChooseModal | `data-modal-close` | Close |
| warmupsChooseModal | `#warmupsChooseEditBtn` | Change my warm-ups |
| warmupsRepeatModal | `data-modal-close` | Close |
| warmupsCountInModal | `data-modal-close` | Close |
| warmupsVolumeModal | `data-modal-close` | Close |
| warmupsVolumeModal | `#warmupsVolumeMinus` | Decrease volume |
| warmupsVolumeModal | `#warmupsVolumePlus` | + |
| warmupsVolumeModal | `#warmupsMuteBtn` | Mute |
| warmupsView | `#warmupsChooseBtn` | Warm-ups |
| warmupsView | `#warmupsSettingsBtn` | settings |
| warmupsView | `#warmupsPrevBtn` | previous |
| warmupsView | `#warmupsNextMainBtn` | Next warm-up |
| warmupsView | `#warmupsPlayBtn` | Play |
| warmupsView | `#warmupsCountIn` | 4 get ready |
| warmupsView | `#warmupsNextBtn` | next |
| warmupListModal | `#warmupListCloseBtn` | Close |
| warmupListModal | `#warmupListSaveBtn` | Save |
| warmupListModal | `#warmupListDeleteBtn` | Delete this list |
| renderWarmupLists() | `data-warmup-edit` |  |
| warmupsRenderChoose() | `data-warmup` | …. … … bpm |
| warmupsRenderChoose() | `data-warmup-locked` | …. … … lock</spa |

## Scales

| Where | Counted as | Words on it |
|---|---|---|
| scalesSettingsModal | `data-modal-close` | Close |
| scalesSettingsModal | `#scalesInstrumentBtn` | - instrument |
| scalesSettingsModal | `#scalesClefBtn` | Treble clef |
| scalesSettingsModal | `#scalesPoolBtn` | 1 grades |
| scalesSettingsModal | `#scalesSizeBtn` | Medium music size |
| scalesSettingsModal | `#scalesSettingsRangeBtn` | See your range |
| scalesSettingsModal | `#scalesDirBtn` | Up down direction |
| scalesSettingsModal | `#scalesDetailBtn` | Notes detail |
| scalesSettingsModal | `#scalesSpeedBtn` | 72 bpm speed |
| scalesSettingsModal | `#scalesNpbBtn` | 1 notes / beat |
| scalesSettingsModal | `#scalesRepeatBtn` | Twice play each one |
| scalesSettingsModal | `#scalesCountInBtn` | 1 bar count-in |
| scalesSettingsModal | `#scalesVolumeBtn` | 80% volume |
| scalesSettingsModal | `data-modal-close` | Done |
| scalesInstrumentModal | `data-modal-close` | Close |
| scalesSizeModal | `data-modal-close` | Close |
| scalesSpeedModal | `data-modal-close` | Close |
| scalesSpeedModal | `#scalesBpmMinus` | Decrease beats per minute |
| scalesSpeedModal | `#scalesBpmPlus` | + |
| scalesRepeatModal | `data-modal-close` | Close |
| scalesClefModal | `data-modal-close` | Close |
| scalesDirModal | `data-modal-close` | Close |
| scalesDetailModal | `data-modal-close` | Close |
| scalesNpbModal | `data-modal-close` | Close |
| scalesCountInModal | `data-modal-close` | Close |
| scalesVolumeModal | `data-modal-close` | Close |
| scalesVolumeModal | `#scalesVolumeMinus` | Decrease volume |
| scalesVolumeModal | `#scalesVolumePlus` | + |
| scalesVolumeModal | `#scalesMuteBtn` | Mute |
| scalesPoolModal | `data-modal-close` | Close |
| scalesPoolModal | `#scalesSeeRangeBtn` | See your range |
| scalesPoolModal | `data-modal-close` | Done |
| scalesChooseModal | `data-modal-close` | Close |
| scalesChooseModal | `#scalesChooseEditBtn` | Change your scales |
| scalesMyRangeModal | `data-modal-close` | Close |
| scalesMyRangeModal | `#scalesMyRangeSetBtn` | Set your range |
| scalesMyRangeModal | `data-modal-close` | Done |
| scalesView | `#scalesChooseBtn` | C major scale |
| scalesView | `#scalesLadderLevelBtn` | 1 level |
| scalesView | `#scalesSettingsBtn` | settings |
| scalesView | `#scalesLevelLink` | Level 1 - change |
| scalesView | `#scalesPrevBtn` | previous |
| scalesView | `#scalesNotYetBtn` | not yet |
| scalesView | `#scalesNextMainBtn` | Next scale |
| scalesView | `#scalesPlayBtn` | Play |
| scalesView | `#scalesCountIn` | 4 get ready |
| scalesView | `#scalesNextBtn` | next |
| scalesView | `#scalesGotItBtn` | got it |
| scalesTile() | `data-option` |  |
| scalesRenderChoose() | `data-pick` |  |

## Theory

| Where | Counted as | Words on it |
|---|---|---|
| theoryPickModal | `data-modal-close` | Close |
| theoryPickModal | `data-modal-close` | Done |
| theorySetModal | `data-modal-close` | Close |
| theorySetModal | `#theorySetUseBtn` | Use these options |
| smartLearnModal | `data-modal-close` | Close |
| smartLearnModal | `#smartLearnActionBtn` | Upgrade now |
| theoryView | `#theoryInstrumentSetBtn` | Choose your instrument - it sets the clef the quizzes start on |
| theoryOptionsView | `#theoryIncludedBtn` | What&#39;s included? |
| theoryOptionsView | `#theorySmartMoreBtn` | Learn more |
| theoryOptionsView | `#theoryStartBtn` | Start |
| theoryPlayView | `#theoryBreakNextBtn` | Next round |
| theoryResultsView | `smartlearn-more` | Learn more |
| theoryResultsView | `#theoryBlockNextBtn` | Next quiz |
| theoryResultsView | `#theoryAgainBtn` | Again |
| theoryResultsView | `#theoryChangeBtn` | Change options |
| theoryResultsView | `#theoryOtherBtn` | Another quiz |
| theoryResultsView | `#theoryHomeBtn` | Home |
| renderTheoryList() | `data-quiz` |  |
| renderTheoryList() | `data-quiz` |  |
| theoryOptionBox() | `data-theory-opt` |  |
| renderTheoryPlayed() | `data-set` |  |
| renderTheoryPlayed() | `#theoryPlayedMoreBtn` | Show more |
| theoryNextQuestion() | `data-id` |  |
| theoryNextQuestion() | `data-id` |  |
| theoryNextQuestion() | `data-id` |  |

## Skills: Tempo, Pulse, Pitch, Rhythm

| Where | Counted as | Words on it |
|---|---|---|
| rhythmView | `#rhythmStartBtn` | Start |
| rhythmView | `#rhythmSheetBtn` | Play through the whole set |
| rhythmView | `#rhythmWordBtn` | My own word for this rhythm |
| rhythmPlayView | `#rhythmPad` | Tap |
| rhythmPlayView | `#rhythmStopBtn` | Stop |
| skillsView | `#skillsAddBtn` | + Add skills |
| skillsView | `#skillListRenameBtn` | Rename this list |
| skillsView | `#skillListDeleteBtn` | Delete this list |
| skillsView | `#warmupListNewBtn` | + New warm-up list |
| tapTempoView | `smartlearn-more` | Learn more |
| tapTempoView | `#tapTempoStartBtn` | Start |
| tapTempoPlayView | `#tapTempoPad` | Tap |
| tapTempoPlayView | `#tapTempoNextBtn` | Next speed |
| gapTrainerView | `#gapTrainerStartBtn` | Start |
| gapTrainerPlayView | `#gapTrainerPad` | Tap the beat |
| gapTrainerPlayView | `#gapTrainerStopBtn` | Stop |
| earView | `smartlearn-more` | Learn more |
| earView | `#earStartBtn` | Start |
| earPlayView | `#earReplayBtn` | Play again |
| earPlayView | `#earSkipBtn` | Skip |
| earPlayView | `#earNextBtn` | Next note |
| drillResultsView | `smartlearn-more` | Learn more |
| drillResultsView | `#drillAgainBtn` | Again |
| drillResultsView | `#drillChangeBtn` | Change options |
| drillResultsView | `#drillOtherBtn` | Another skill |
| drillResultsView | `#drillHomeBtn` | Home |
| skillsAddModal | `#skillsAddCloseBtn` | Close |
| skillsAddModal | `#skillsAddDoneBtn` | Add |
| renderToolResults() | `data-tool-view` |  |
| renderSkills() | `data-skill-list` |  |
| renderSkills() | `#skillListNewBtn` | + New list |
| renderSkills() | `data-skill-remove` |  |
| renderDrillOptions() | `data-drill-opt` |  |
| renderDrillPlayed() | `data-set` |  |
| renderDrillPlayed() | `data-more` | Show more |
| renderSkillsHub() | `data-skill-view` |  |
| earShowQuestion() | `data-id` |  |
| openRhythmPicker() | `data-rhythm` |  |

## Range

| Where | Counted as | Words on it |
|---|---|---|
| rangeView | `#rangeSetBtn` | Set your range |
| rangeView | `#rangeStartBtn` | Start - listen with the microphone |
| rangeView | `#rangeHeldBtn` | Held it (8 beats) |
| rangeView | `#rangeNotYetBtn` | Not yet |
| rangePickerModal | `#rangePickerCloseBtn` | Close without saving |
| rangePickerModal | `#rangeBottomStave` | Bottom note - tap the stave near a note to pick it |
| rangePickerModal | `#rangeBottomMinus` | Bottom note a semitone lower |
| rangePickerModal | `#rangeBottomPlus` | + |
| rangePickerModal | `#rangeTopStave` | Top note - tap the stave near a note to pick it |
| rangePickerModal | `#rangeTopMinus` | Top note a semitone lower |
| rangePickerModal | `#rangeTopPlus` | + |
| rangePickerModal | `#rangeMeasureBtn` | Measure it with the tuner |
| rangePickerModal | `#rangePickerCancelBtn` | Cancel |
| rangePickerModal | `#rangePickerSaveBtn` | Save |

## Pieces: Rehearse, play, edit

| Where | Counted as | Words on it |
|---|---|---|
| rehearseView | `data-music-tab=pieces` | Pieces |
| rehearseView | `data-music-tab=lists` | Practice lists |
| rehearseView | `#rehearseAddBtn` | + Add a piece |
| rehearseView | `#practiceListNewBtn` | + New practice list |
| metroBuilderView | `#metroBlkMiniTunerInstrumentBtn` | C |
| metroBuilderView | `#metroBlkMiniTunerCloseBtn` | Close tuner |
| metroBuilderView | `#myMusicMenuBtn` | My music options |
| metroBuilderView | `#flowBulkArchiveBtn` | Archive several pieces |
| metroBuilderView | `#flowBulkDeleteBtn` | Delete several pieces |
| metroBuilderView | `data-music-tab=pieces` | Pieces |
| metroBuilderView | `data-music-tab=lists` | Practice lists |
| metroBuilderView | `data-new-list` | + New practice list |
| metroBuilderView | `#myMusicAddBtn` | + Add a piece |
| metroBuilderView | `#flowLibraryItemMenuPlay` | Play |
| metroBuilderView | `#flowLibraryItemMenuEdit` | Edit |
| metroBuilderView | `#flowLibraryItemMenuDuplicate` | Duplicate |
| metroBuilderView | `#flowLibraryItemMenuCopy` | Copy to my library |
| metroBuilderView | `#flowLibraryItemMenuExport` | Export to MusicXML |
| metroBuilderView | `#flowLibraryItemMenuBandSummary` | Band summary |
| metroBuilderView | `#flowLibraryItemMenuArchive` | Archive |
| metroBuilderView | `#flowLibraryItemMenuRestore` | Restore |
| metroBuilderView | `#flowLibraryItemMenuReport` | Report |
| metroBuilderView | `#flowLibraryItemMenuDelete` | Delete |
| flowFromFileView | `#flowFromFileDropBtn` | Tap to browse score file Select a MusicXML or .mxl file MUSICXML MXL M |
| flowFromFileView | `#flowFromFileContinueBtn` | Continue to flow |
| flowDetailsHubView | `#flowEditTabDetailsBtn` | Details |
| flowDetailsHubView | `#flowEditTabBlocksBtn` | Bars |
| flowDetailsHubView | `#flowEditTabMediaBtn` | Media |
| flowDetailsHubView | `#flowAudienceBtn` | Just me who it's for |
| flowDetailsHubView | `#flowUploadRecordingBtn` | Upload mp3 / mp4 audio (up to 25 MB) |
| flowDetailsHubView | `#flowAddYouTubeBtn` | Add YouTube link |
| flowDetailsHubView | `#flowUploadDocumentBtn` | Upload PDF or MusicXML score (up to 25 MB) |
| flowDetailsHubView | `data-flow-layout` | 1 column |
| flowDetailsHubView | `data-flow-layout` | 2 columns |
| flowDetailsHubView | `data-flow-layout` | 4 columns |
| flowDetailsHubView | `#flowAddBlockBtn` | + Add bar |
| flowDetailsHubView | `#flowEditStickySecondaryBtn` | Add media |
| flowDetailsHubView | `#flowEditStickyActionBtn` | Add bars |
| flowDetailsHubView | `#flowEditCancelBtn` | Cancel |
| flowDetailsHubView | `#flowEditSaveBtn` | Save |
| flowPlayView | `#flowSeeHearBtn` | What to see and hear |
| flowPlayView | `#flowAlongMarkBtn` | Timing of the video still to be confirmed |
| flowPlayView | `#flowLoopBtn` | off repeat |
| flowPlayView | `#flowPlaybackBtn` | 100% playback |
| flowPlayView | `#flowResetBtn` | reset |
| flowPlayView | `#flowPlayBtn` | play |
| flowPlayView | `#flowSessionFinishBtn` | finish |
| flowPlayView | `#flowPlayMenuBtn` | Flow options |
| flowPlayView | `#flowPlayMenuEditDetails` | Edit details |
| flowPlayView | `#flowPlayMenuEditFlow` | Edit bars |
| flowPlayView | `#flowPlayMenuLevels` | My Levels |
| flowPlayView | `#flowPlayMenuCopy` | Copy to my library |
| flowPlayView | `#flowPlayMenuLoadLibrary` | Load from library |
| flowPlayView | `#flowPlayMenuCreateNew` | Create new |
| flowPlayView | `#flowPlayMenuReport` | Report |
| flowPlayView | `#flowMovementBtn` | all movement |
| flowPlayView | `data-flow-play-layout` | 1 column |
| flowPlayView | `data-flow-play-layout` | 2 columns |
| flowPlayView | `data-flow-play-layout` | 4 columns |
| top bar | `#flowBlockMenuDuplicate` | Duplicate |
| top bar | `#flowBlockMenuMoveUp` | Move up |
| top bar | `#flowBlockMenuMoveDown` | Move down |
| top bar | `#flowBlockMenuDelete` | Delete bar |
| top bar | `#flowFermataRowMenuEdit` | Edit |
| top bar | `#flowFermataRowMenuDelete` | Delete |
| top bar | `#flowRampRowMenuEdit` | Edit |
| top bar | `#flowRampRowMenuDelete` | Delete |
| flowBpmModal | `#flowBpmCloseBtn` | Close |
| flowBpmModal | `#flowBpmMinus` | Decrease bpm |
| flowBpmModal | `#flowBpmPlus` | + |
| flowBarsModal | `#flowBarsCloseBtn` | Close |
| flowBarsModal | `#flowBarsMinus` | Decrease bars |
| flowBarsModal | `#flowBarsPlus` | + |
| flowChoiceModal | `hide-modal(flowChoiceModal)` | Close |
| flowChoiceModal | `#flowChoiceCancelBtn` | Cancel |
| flowFermataModal | `#flowFermataCloseBtn` | Close |
| flowFermataModal | `#flowFermataOpenFormBtn` | + Add another pause |
| flowFermataModal | `#flowFermataBarMinus` | Decrease bar |
| flowFermataModal | `#flowFermataBarPlus` | + |
| flowFermataModal | `#flowFermataBeatMinus` | Decrease beat |
| flowFermataModal | `#flowFermataBeatPlus` | + |
| flowFermataModal | `#flowFermataDurationMinus` | Decrease duration |
| flowFermataModal | `#flowFermataDurationPlus` | + |
| flowFermataModal | `#flowFermataAddBtn` | + Insert pause into block |
| flowFermataModal | `#flowFermataCancelEditBtn` | Cancel |
| flowRampModal | `#flowRampCloseBtn` | Close |
| flowRampModal | `#flowRampOpenFormBtn` | + Add another ramp |
| flowRampModal | `#flowRampBarMinus` | Decrease start bar |
| flowRampModal | `#flowRampBarPlus` | + |
| flowRampModal | `#flowRampBeatMinus` | Decrease start beat |
| flowRampModal | `#flowRampBeatPlus` | + |
| flowRampModal | `data-ramp-end-mode=block_end` | End of block |
| flowRampModal | `data-ramp-end-mode=specific` | Specific beat |
| flowRampModal | `#flowRampEndBarMinus` | Decrease end bar |
| flowRampModal | `#flowRampEndBarPlus` | + |
| flowRampModal | `#flowRampEndBeatMinus` | Decrease end beat |
| flowRampModal | `#flowRampEndBeatPlus` | + |
| flowRampModal | `#flowRampCustomTempoBtn` | 120 bpm |
| flowRampModal | `#flowRampAddBtn` | + Insert ramp into block |
| flowRampModal | `#flowRampCancelEditBtn` | Cancel |
| flowBandPickerModal | `close (X)` | Close |
| flowBandPickerModal | `#flowBandPickerConfirmBtn` | Move |
| flowBandPickerModal | `hide-modal(flowBandPickerModal)` | Cancel |
| flowYouTubeModal | `close (X)` | Close |
| flowYouTubeModal | `#flowYouTubeSaveBtn` | Add video to flow |
| flowYouTubeModal | `hide-modal(flowYouTubeModal)` | Cancel |
| clipModal | `clip-close` | Close |
| clipModal | `clip-mark(start)` | Starts here |
| clipModal | `clip-nudge(start)` | 1 second back |
| clipModal | `clip-nudge(start)` | 1 second on |
| clipModal | `clip-mark(end)` | Ends here |
| clipModal | `clip-nudge(end)` | 1 second back |
| clipModal | `clip-nudge(end)` | 1 second on |
| clipModal | `clip-try` | Play from the start mark |
| clipModal | `#clipClearBtn` | Use all of it |
| clipModal | `clip-save` | Done |
| clipModal | `clip-close` | Cancel |
| barMapModal | `barmap-close` | Close |
| barMapModal | `barmap-clip-mark(start)` | Starts here |
| barMapModal | `barmap-clip-nudge(start)` | 1 second back |
| barMapModal | `barmap-clip-nudge(start)` | 1 second on |
| barMapModal | `#barMapPrevBtn` | Bar before |
| barMapModal | `#barMapNextBtn` | Next bar |
| barMapModal | `barmap-go` | Go |
| barMapModal | `barmap-mark` | This is bar 1 |
| barMapModal | `barmap-clip-mark(end)` | Ends here |
| barMapModal | `barmap-clip-nudge(end)` | 1 second back |
| barMapModal | `barmap-clip-nudge(end)` | 1 second on |
| barMapModal | `barmap-save` | Done |
| barMapModal | `#barMapMatchBtn` | Match the piece's speeds to these marks |
| barMapModal | `barmap-close` | Cancel |
| flowSubdivideModal | `hide-modal(flowSubdivideModal)` | Close |
| flowSubdivideModal | `#flowSubdivideMinus` | Decrease sub beats |
| flowSubdivideModal | `#flowSubdividePlus` | + |
| flowSubdivideModal | `#flowSubdivideDoneBtn` | Done |
| flowBulkDeleteModal | `close (X)` | Close |
| flowBulkDeleteModal | `#flowBulkDeleteDoneBtn` | Delete |
| flowBulkArchiveModal | `close (X)` | Close |
| flowBulkArchiveModal | `#flowBulkArchiveDoneBtn` | Archive |
| outlineExtraModal | `close (X)` | Close |
| outlineExtraModal | `#outlineExtraSaveBtn` | Add it |
| outlineExtraModal | `#outlineExtraRemoveBtn` | Remove this extra |
| flowSeeHearModal | `hide-modal(flowSeeHearModal)` | Close |
| flowSeeHearModal | `#flowVolumeMinus` | Decrease volume |
| flowSeeHearModal | `#flowVolumePlus` | + |
| flowSeeHearModal | `#flowMuteBtn` | Mute |
| metroBlkMiniTunerInstrumentModal | `hide-modal(metroBlkMiniTunerInstrumentModal)` | Close |
| metroSegNoteModal | `hide-modal(metroSegNoteModal)` | Close |
| flowBarStartModal | `hide-modal(flowBarStartModal)` | Close |
| flowBarEndModal | `hide-modal(flowBarEndModal)` | Close |
| flowSignModal | `#flowSignCloseBtn` | Close |
| flowJumpModal | `#flowJumpCloseBtn` | Close |
| flowRepeatBarModal | `#flowRepeatBarCloseBtn` | Close |
| flowRepeatBarModal | `#flowRepeatBarStartMinus` | Decrease start bar |
| flowRepeatBarModal | `#flowRepeatBarStartPlus` | + |
| flowRepeatBarModal | `#flowRepeatBarCancelBtn` | Cancel |
| flowRepeatBarModal | `#flowRepeatBarSaveBtn` | Save |
| flowLoopModal | `#flowLoopCloseBtn` | Close |
| flowLoopModal | `#flowLoopStartMinus` | Decrease start bar |
| flowLoopModal | `#flowLoopStartPlus` | + |
| flowLoopModal | `#flowLoopEndMinus` | Decrease end bar |
| flowLoopModal | `#flowLoopEndPlus` | + |
| flowLoopModal | `#flowLoopOffBtn` | Turn off |
| flowLoopModal | `#flowLoopSaveBtn` | Repeat |
| flowIntroModal | `#flowIntroCloseBtn` | Close |
| flowIntroModal | `#flowIntroStartMinus` | Decrease start bar |
| flowIntroModal | `#flowIntroStartPlus` | + |
| flowIntroModal | `#flowIntroEndMinus` | Decrease end bar |
| flowIntroModal | `#flowIntroEndPlus` | + |
| flowIntroModal | `#flowIntroCancelBtn` | Cancel |
| flowIntroModal | `#flowIntroSaveBtn` | Save |
| metroSegTimeSigModal | `hide-modal(metroSegTimeSigModal)` | Close |
| metroSegTimeSigModal | `#metroSegCustomSigAddBtn` | Set |
| metroSegTimeSigModal | `hide-modal(metroSegTimeSigModal)` | Done |
| listItemModal | `close (X)` | Close |
| listItemModal | `hide-modal(listItemModal)` | Cancel |
| listItemModal | `#liSaveBtn` | Save |
| listItemModal | `#liActionBtn` | Remove |
| flowCheckModal | `#flowCheckCloseBtn` | Close |
| flowCheckModal | `#flowCheckFixBtn` | Go back and fix |
| flowCheckModal | `#flowCheckContinueBtn` | Save anyway |
| outlineOpenChecksModal | `close (X)` | Close |
| outlineOpenChecksModal | `#outlineOpenChecksNo` | No |
| outlineOpenChecksModal | `#outlineOpenChecksYes` | Yes |
| renderRehearseList() | `data-rehearse-id` |  |
| renderFlowPlaybackModal() | `pb-option` |  |
| renderFlowPlaybackModal() | `data-pb-level` |  |
| renderFlowsList() | `data-flow-library-menu-btn` |  |
| flowMediaItemHtml() | `rec-map` | … · … start, bars and end |
| flowMediaItemHtml() | `flow-speeds-restore` | Put the original speeds back |
| flowMediaItemHtml() | `flow-recording-clip` | … start and end |
| flowMediaItemHtml() | `flow-recording-movement` | … movement |
| flowMediaItemHtml() | `flow-recording-delete` |  |
| renderFlowRecordingsList() | `flow-speeds-restore` | Put the original speeds back |
| renderFlowDocumentsList() | `open-url` |  |
| renderFlowDocumentsList() | `flow-document-delete` |  |
| flowBlockTileSectionsHtml() | `data-block-tile=time` | … time |
| flowBlockTileSectionsHtml() | `data-block-tile=beatUnit` | … beat note |
| flowBlockTileSectionsHtml() | `data-block-tile=bpm` | … bpm |
| flowBlockTileSectionsHtml() | `data-block-tile=bars` | … bars |
| flowBlockTileSectionsHtml() | `data-block-tile=start` | … start |
| flowBlockTileSectionsHtml() | `data-block-tile=end` | … end |
| flowBlockTileSectionsHtml() | `data-block-tile=repeatBar` | … alt ending |
| flowBlockTileSectionsHtml() | `data-block-tile=intro` | … bar range |
| flowBlockTileSectionsHtml() | `data-block-tile=pause` | … pause |
| flowBlockTileSectionsHtml() | `data-block-tile=change` | … ramp |
| flowBlockTileSectionsHtml() | `data-block-tile=sign` | … sign |
| flowBlockTileSectionsHtml() | `data-block-tile=jump` | … jump |
| flowBlockMarkBoxHtml() | `data-block-tile=rehearsalMark` |  |
| flowBlockMarkBoxHtml() | `data-block-tile=rehearsalMark` | + RM |
| flowBlockCardHtml() | `data-block-grab-handle` |  |
| flowBlockCardHtml() | `data-block-menu-btn` |  |
| renderFlowBarGrid() | `data-block-id` |  |
| flowBarFullTileHtml() | `flow-jump` |  |
| flowLeadInPlayTileHtml() | `flow-jump` |  |
| flowBarDetailTileHtml() | `flow-jump` |  |
| flowBarDetailTileHtml() | `data-block-id` |  |
| renderFlowBarPopup() | `data-bar-popup=prev` | Previous bar |
| renderFlowBarPopup() | `data-bar-popup=next` | Next bar |
| renderFlowBarPopup() | `data-bar-popup=close` | Close |
| renderFlowBarPopup() | `data-bar-popup=earlier` | Move earlier |
| renderFlowBarPopup() | `data-bar-popup=duplicate` | Duplicate |
| renderFlowBarPopup() | `data-bar-popup=later` | Move later |
| renderFlowBarPopup() | `data-bar-popup=delete` | Delete this bar |
| openFlowChoiceModal() | `data-choice-idx` |  |
| renderFlowRepeatBarModal() | `data-pass` |  |
| flowOpenNotePicker() | `data-note` |  |
| flowOpenBarStartPicker() | `data-start-option` |  |
| flowBarlinePickerTileHtml() | `data-option` |  |
| flowGlyphPickerTileHtml() | `data-option` |  |
| renderFlowFermataList() | `data-pause-edit` |  |
| renderFlowFermataList() | `data-pause-menu` | Pause options |
| renderFlowFermataAddSection() | `data-pause-kind` | … … … </button |
| renderFlowRampList() | `data-ramp-edit` |  |
| renderFlowRampList() | `data-ramp-menu` | Ramp options |
| renderFlowRampAddSection() | `data-ramp-target` |  |
| flowShowCheckReview() | `data-check-block` |  |
| renderBarMapModal() | `barmap-play` | Play |
| renderBarMapModal() | `barmap-remove` | Remove |
| renderFlowSeeHear() | `#flowAlongAddBtn` | Add a recording or video |
| renderFlowSeeHear() | `data-along-rec` |  |
| renderFlowLoopModal() | `data-rest` |  |
| loadFlowPlaybackSpeeds() | `data-value` | …% |
| renderMetroSegTimeSigPicker() | `data-value` |  |
| renderMetroSegTimeSigChips() | `data-value` |  |
| renderMetroSegTimeSigChips() | `data-remove-id` |  |
| renderMetroSegCustomSigManageList() | `timesig-delete` |  |
| renderMetroSegCustomSigManageList() | `timesig-archive` | Archive |
| renderMetroBlkMiniTunerInstrumentOptions() | `data-value` |  |
| renderOutline() | `data-outline=back` | Back |
| renderOutline() | `data-outline` |  |
| outlineValueBtn() | `data-outline` |  |
| outlineTile() | `data-outline` |  |
| outlinePickNote() | `data-note` |  |
| outlineTimeRowHtml() | `data-time-pick` |  |
| outlineSpeedRowHtml() | `data-speed-note` |  |
| outlineTableRowHtml() | `data-xkind` |  |
| outlineTableRowHtml() | `data-xends` |  |
| outlineExtrasStepHtml() | `data-outline-extra` | …</stron |
| outlineExtrasStepHtml() | `data-outline=addExtra` | + … |
| outlineMediaStepHtml() | `data-outline-media-remove` |  |
| outlineMediaStepHtml() | `data-outline=addVideo` | + Add the link |
| outlineMediaStepHtml() | `data-outline=pickFile` | + … |
| renderOutlineExtraForm() | `data-x-sign` |  |
| renderOutlineEndingsForm() | `data-ends-add` | + Add another ending |
| outlineAnswerBox() | `data-read-answer` |  |
| outlineReadChecksHtml() | `data-read-all` | All right as read |
| outlineReadAskSave() | `data-read-go` |  |

## Add a piece

| Where | Counted as | Words on it |
|---|---|---|
| addPieceView | `#addPieceOwnerBtn` | Just me who it's for |
| addPieceView | `#addPieceListBtn` | On its own practice list |
| addPieceView | `#metroBlkEntryCreateBtn` | Create your own Put the bars in yourself |
| addPieceView | `#metroBlkEntryQuickBtn` | Quick entry Bars and marks first, then what's different |
| addPieceView | `#metroBlkEntryPhotoBtn` | From a photo or PDF Uses AI to import the piece |
| addPieceView | `#metroBlkEntryFromFileBtn` | Import from MusicXML Open a MusicXML or .mxl file from notation softwa |
| addPieceNewListForm() | `#addPieceNewListSaveBtn` | Save |
| addPieceValueBoxHtml() | `data-value-box` |  |

## Recordings

| Where | Counted as | Words on it |
|---|---|---|
| recordingsView | `#recordingsUploadBtn` | Upload a rehearsal recording |
| recordingsView | `#recordingsYouTubeBtn` | Add a YouTube video |
| renderRecordings() | `recordings-cut-change` | Change |
| renderRecordings() | `recordings-cut-remove` | Remove |
| renderRecordings() | `recordings-give` | Give it to a piece |
| renderRecordings() | `recordings-delete` | Delete this recording |

## Practice lists

| Where | Counted as | Words on it |
|---|---|---|
| practiceListView | `#plDateBtn` | None target date |
| practiceListView | `#plWeekBtn` | None a week |
| practiceListView | `#plMinsBtn` | None minutes |
| practiceListView | `#plWarmBtn` | None warm-up |
| practiceListView | `#plPieceMenuMovement` | Which movement |
| practiceListView | `#plPieceMenuLevels` | Prepare levels |
| practiceListView | `#plPieceMenuDelete` | Delete |
| practiceListView | `#plAddPiecesBtn` | + Add pieces |
| practiceListView | `#plPlanBtn` | Plan a session for this |
| practiceListView | `#plArchiveBtn` | Archive this list |
| practiceListView | `#plReportBtn` | Report this list |
| practiceListView | `#plClearRecordingsBtn` | Delete this list's recordings |
| practiceListView | `#plDeleteBtn` | Delete this list |
| renderPracticeListRows() | `data-list` |  |
| renderPracticeList() | `data-piece` |  |
| renderPracticeList() | `data-piece-menu` |  |

## Home and All tools

| Where | Counted as | Words on it |
|---|---|---|
| mainView | `#homeAvatar` | Your avatar - change it in My details |
| mainView | `#startPracticeSessionBtn` | Start a practice session |
| mainView | `view(entryForm)` | Log time you've already played |
| mainView | `view(toolsView)` | All tools |
| toolsView | `view(quickPlayView)` | Metronome |
| toolsView | `view(tunerView)` | Tuner |
| toolsView | `view(timerView)` | Timer |
| toolsView | `#tuningForkToolBtn` | Tuning fork |
| toolsView | `#warmupsToolBtn` | Warm-ups |
| toolsView | `#scalesToolBtn` | Scales |
| toolsView | `#addPieceToolBtn` | Add a piece |
| toolsView | `#prepareToolBtn` | Prepare |
| toolsView | `#rehearseToolBtn` | Rehearse |
| toolsView | `#recordingsToolBtn` | Recordings |
| toolsView | `#theoryToolBtn` | Theory |
| toolsView | `#skillsToolBtn` | Skills |
| toolsView | `#rangeToolBtn` | Range |
| toolsView | `#toolsEditBtn` | Choose favourite tools |
| top bar | `#homeToolMenuEarlier` | Move earlier |
| top bar | `#homeToolMenuLater` | Move later |
| top bar | `#homeToolMenuRemove` | Remove from favourites |

## Stats

| Where | Counted as | Words on it |
|---|---|---|
| statsHomeView | `view(statsView)` | Practice time this week - |
| statsHomeView | `view(statsView)` | Practice time this month - |
| statsHomeView | `view(statsView)` | Practice time this year - |
| statsHomeView | `view(streakStatsView)` | Current practice streak - |
| statsHomeView | `view(streakStatsView)` | Longest practice streak - |
| statsHomeView | `view(historyView)` | Sessions this week - |
| statsHomeView | `view(historyView)` | Sessions this month - |
| statsHomeView | `view(rehearseView)` | Next concert - |
| statsHomeView | `view(theoryView)` | Last Theory Level - |
| statsHomeView | `view(toolResultsView)` | Tools last played - |
| statsHomeView | `#statsEditBtn` | Choose Home stats |
| statsView | `scroll-area` |  |
| statsView | `scroll-area` |  |
| statsView | `scroll-area` |  |
| statsView | `scroll-area` |  |
| statsView | `scroll-area` |  |
| statsView | `scroll-area` |  |
| statsView | `scroll-area` |  |
| statsView | `scroll-area` |  |
| statsView | `scroll-area` |  |
| statsView | `scroll-area` |  |
| historyView | `view(entryForm)` | Add session time |
| historyView | `#prevMonthBtn` |  |
| historyView | `#nextMonthBtn` |  |
| renderHistoryList() | `data-session-history-menu-btn` |  |

## Instrument support

| Where | Counted as | Words on it |
|---|---|---|
| top bar | `#instrumentSupportNavItem` | Instrument support |
| instrumentSupportView | `#supportNearBtn` | My bands' towns near |
| instrumentSupportView | `#supportForBtn` | Everything looking for |
| instrumentSupportView | `feedback` | Something wrong or missing? Tell us |
| supportBusinessModal | `close (X)` | Close |
| supportTownModal | `close (X)` | Close |
| supportRowHtml() | `data-support-id` |  |
| openSupportBusiness() | `data-support-open=link` |  |
| openSupportBusiness() | `data-support-open=phone` | Call … |
| openSupportBusiness() | `data-support-open=email` | Email … |
| searchSupportTowns() | `data-town` |  |

## Set-up

| Where | Counted as | Words on it |
|---|---|---|
| setupValueBox() | `data-setup` |  |
| setupInstrumentRowHtml() | `data-setup` |  |
| setupPlayHtml() | `data-setup=instrument` | + … |
| setupBandsHtml() | `data-setup=band` | + … |
| renderSetup() | `data-setup=back` | Back |
| renderSetup() | `data-setup=next` |  |
| setupOpenInstrument() | `data-setup-clef` |  |
| setupOpenInstrument() | `data-setup-inst=main` | Make it my main instrument |
| setupOpenInstrument() | `data-setup-inst=remove` | Remove it from my list |
| setupPickBand() | `#setupNewBandAdd` | Add it |

## My bands

| Where | Counted as | Words on it |
|---|---|---|
| accountBandsView | `#tidyBandsLink` | Tidy my bands |
| accountBandsView | `#accountJoinBandBtn` | Add |
| accountBandsView | `#accountAddBandToggleBtn` | Can't find your band? Add it |
| accountBandsView | `#accountAddBandBtn` | Add |
| bandWelcomeView | `#bandWelcomeJoinBtn` | Join the band |
| bandWelcomeView | `#bandWelcomeLaterBtn` | Not now |
| bandView | `#bandPageEditBtn` | Edit the band |
| bandView | `#bandPageMembersLink` | Members |
| bandView | `#bandPageNoticeLink` | Tell the band |
| bandView | `#bandPageDirectoryBtn` | It's a band in the list |
| bandView | `#bandPageMergeBtn` | Same as another band of mine |
| bandView | `#bandPageHideBtn` | I don't play with them now |
| bandView | `#bandPageLeaveBtn` | Leave the shared band |
| bandView | `#bandPageStopBtn` | Stop sharing |
| bandView | `#bandPageReportBtn` | Report the band's name |
| bandView | `#bandPageShareBtn` | Set up sharing |
| bandNoticeView | `#bandNoticeSendBtn` | Send to the band |
| bandMembersView | `#bandInviteLevelBtn` | Can play what they can do |
| bandMembersView | `#bandInviteBtn` | Invite |
| bandEditModal | `close (X)` | Close |
| bandEditModal | `#bandEditLogoBtn` | Add a logo |
| bandEditModal | `#bandEditLogoChoose` | Choose a new logo |
| bandEditModal | `#bandEditLogoRemove` | Take the logo off |
| bandEditModal | `#bandEditCancelBtn` | Cancel |
| bandEditModal | `#bandEditSaveBtn` | Save |
| renderAccountBandInvites() | `data-invite-accept` | Join … |
| renderAccountBandInvites() | `data-invite-decline` | No thanks |
| renderAccountBandsList() | `data-band-open` |  |
| renderTidyBands() | `data-tidy-band` | … … - tap to say what it is |
| renderBandMembers() | `data-member` |  |
| renderBandMembers() | `data-invite` |  |

## My account, instruments, settings

| Where | Counted as | Words on it |
|---|---|---|
| settingsView | `view(settingsDisplayView)` | Display and reading |
| settingsView | `view(settingsStatsView)` | Stats |
| settingsView | `view(settingsTunerView)` | Tuner |
| settingsView | `view(settingsPlaybackView)` | Metronome playback |
| settingsView | `#settingsNoticesLink` | Notifications Which notices the app sends you |
| settingsView | `#settingsSetupLink` | Set up again What I play, how it looks, who I play with |
| settingsDisplayView | `#displayResetBtn` | Reset to standard |
| settingsPlaybackView | `#metroCalibLatencyMinusBtn` | Less delay |
| settingsPlaybackView | `#metroCalibLatencyPlusBtn` | + |
| settingsPlaybackView | `#metroCalibPlayBtn` | test |
| settingsPlaybackView | `#metroCalibLatencyResetBtn` | reset |
| accountView | `view(accountDetailsView)` | My details |
| accountView | `#accountSecurityRow` | Sign-in and security |
| accountView | `#accountTeachersRow` | My teachers |
| accountDetailsView | `#accountEditNameBtn` | Name - , edit |
| accountDetailsView | `#accountEditDisplayNameBtn` | Display name - , edit |
| accountDetailsView | `#accountEditAvatarBtn` | Avatar , change |
| accountDetailsView | `#accountEditEmailBtn` | Email , change |
| accountDetailsView | `#accountExportBtn` | Download my information |
| accountDetailsView | `#accountDeleteBtn` | Delete my account |
| accountInstrumentsView | `#accountAddInstrumentBtn` | Add |
| accountInstrumentsView | `#supportFromInstrumentsLink` | Need a repair, a shop or hire? Instrument support - near your bands |
| accountTeachersView | `list-add(teachers)` | Add |
| top bar | `#accountInstrumentMenuMain` | Make main instrument |
| top bar | `#accountInstrumentMenuRange` | My range |
| top bar | `#accountInstrumentMenuClef` | My clef |
| top bar | `#accountInstrumentMenuRemove` | Remove |
| accountNameModal | `data-account-name-cancel` | Close |
| accountNameModal | `#accountCancelNameBtn` | Cancel |
| accountNameModal | `#accountSaveNameBtn` | Save |
| accountDisplayNameModal | `data-account-name-cancel` | Close |
| accountDisplayNameModal | `#accountCancelDisplayNameBtn` | Cancel |
| accountDisplayNameModal | `#accountSaveDisplayNameBtn` | Save |
| accountEmailModal | `close (X)` | Close |
| accountEmailModal | `#accountEmailCancelBtn` | Cancel |
| accountEmailModal | `#accountEmailSendBtn` | Send the link |
| avatarModal | `data-modal-close` | Close |
| accountDeleteModal | `close (X)` | Close |
| accountDeleteModal | `#accountDeleteConfirmBtn` | Delete my account for good |
| accountDeleteModal | `keep-account` | Keep my account |
| renderSettingsList() | `list-edit` | Edit |
| renderAccountInstruments() | `data-instrument-menu-id` |  |
| renderTwoStepSetup() | `data-two-step-open` | Add to my authenticator app |
| renderTwoStepSetup() | `data-two-step-copy-key` | Copy the setup key |
| renderTwoStepSetup() | `data-two-step-confirm` | Turn on two-step sign-in |
| renderRecoveryCodes() | `data-codes-copy` | Copy the codes |
| renderRecoveryCodes() | `data-codes-done` |  |
| renderPasswordPanel() | `#accountPasswordOpenBtn` | Change password |
| renderPasswordPanel() | `#accountPasswordOpenBtn` | Add a password |
| renderPasswordPanel() | `#accountPasswordSaveBtn` | Save |
| renderPasswordPanel() | `#accountPasswordCancelBtn` | Cancel |
| renderAccountSecurity() | `#accountTwoStepStartBtn` | Set up two-step sign-in |
| renderAccountSecurity() | `#accountNewCodesBtn` | New recovery codes |
| renderAccountSecurity() | `#accountTwoStepOffBtn` | Turn off two-step sign-in |
| renderAccountSecurity() | `#accountTwoStepConfirmBtn` | Confirm |
| renderAccountSecurity() | `#accountTwoStepCancelBtn` | Cancel |
| renderAvatarGrid() | `data-avatar` |  |

## Signing in

| Where | Counted as | Words on it |
|---|---|---|
| top bar | `#loginBtn` | Sign in with Google |
| top bar | `data-password-toggle=loginPassword` | Show password |
| top bar | `#passwordLoginSubmit` | Log in |
| top bar | `#forgotLinkBtn` | Forgot your password? |
| top bar | `#forgotSubmit` | Send the link |
| top bar | `#forgotBackBtn` | Back to log in |
| top bar | `#emailChangeConfirmBtn` | Change my email address |
| top bar | `#emailChangeBackBtn` | Not now |
| top bar | `data-password-toggle=setPassword` | Show password |
| top bar | `data-password-toggle=setPasswordConfirm` | Show password |
| top bar | `#setPasswordSubmit` | Save and log in |
| top bar | `#setPasswordLoginLink` | Go to log in |
| top bar | `#twoStepSubmit` | Continue |
| top bar | `#twoStepRecoveryBtn` | Use a recovery code instead |
| passwordFieldHtml() | `data-password-toggle` | Show password |

## Menu, notices and the rest

| Where | Counted as | Words on it |
|---|---|---|
| noticeBannerModal | `close (X)` | Close |
| top bar | `data-notice-banner-open` | Notice |
| top bar | `data-notice-banner-close` | Hide this notice until next time |
| top bar | `#topBackBtn` |  |
| top bar | `#topTunerToggleBtn` | Show tuner |
| top bar | `#topTimerPill` | 00:00 left |
| top bar | `#topTimerIconBtn` | Timer |
| top bar | `#navBurgerMenuBtn` | ☰ |
| top bar | `#navRailFoldBtn` | Fold the menu to icons |
| top bar | `view-menu(mainView)` | Home |
| top bar | `#notificationsNavItem` | Notifications |
| top bar | `#navToolsBtn` | Tools |
| top bar | `view-menu(statsHomeView)` | Stats |
| top bar | `#myMusicNavItem` | My music |
| top bar | `view-menu(accountBandsView)` | My bands |
| top bar | `view-menu(settingsView)` | My app settings |
| top bar | `view-menu(accountInstrumentsView)` | My instruments |
| top bar | `#inviteNavItem` | Invite someone |
| top bar | `#feedbackNavItem` | Send feedback |
| top bar | `view-menu(aboutView)` | About |
| top bar | `view-menu(accountView)` | My account |
| top bar | `logout` | Log out |
| top bar | `#navToolsBackBtn` | Tools |
| top bar | `data-notice-banner-open` | Notice |
| top bar | `data-notice-banner-close` | Hide this notice until next time |
| top bar | `reload` | Reload |
| top bar | `#updateBannerMore` | See what's new |
| top bar | `#updateBannerClose` | Hide until next time |
| top bar | `#startupBarBtn` | Try again |
| top bar | `#offlineBarBtn` | See them |
| top bar | `#previewStopBtn` | Stop previewing |
| notificationsView | `#notificationsMarkAllBtn` | Mark all as read |
| notificationsView | `#notificationsClearAllBtn` | Clear all |
| notificationsView | `#notificationsClearedBtn` | Show cleared |
| inviteView | `#inviteLevelBtn` | Standard member account type |
| inviteView | `#inviteSendBtn` | Send invite |
| aboutView | `view(aboutReleasesView)` | Release history What changed in each version |
| aboutView | `about-policy(privacy)` | Privacy policy What we hold about you, and how to delete it |
| aboutView | `about-policy(terms)` | Terms of use The terms for using the app |
| aboutView | `view(aboutGradesView)` | Exam grades Where the grade lists come from |
| importantNoticeModal | `#importantNoticeOkBtn` | Got it |
| urgentNotificationModal | `#urgentNotificationOkBtn` | Got it |
| whatsNewModal | `close (X)` | Close |
| whatsNewModal | `reload` | Reload now |
| policyModal | `close (X)` | Close |
| top bar | `#submitBtn` | Save session |
| top bar | `#cancelAddBtn` | Cancel |
| levelRateModal | `#levelRateCloseBtn` | Close without answering |
| levelRateModal | `#levelRateMoreBtn` | Move up even further |
| pieceReadWaitModal | `#pieceReadWaitX` | Cancel |
| pieceReadWaitModal | `#pieceReadWaitCancel` | Cancel |
| confirmModal | `close (X)` | Close |
| confirmModal | `#confirmCancelBtn` | Cancel |
| confirmModal | `#confirmActionBtn` | Confirm |
| offlineModal | `close (X)` | Close |
| offlineModal | `#offlineSyncBtn` | Sync now |
| reportModal | `close (X)` | Close |
| reportModal | `#reportCancelBtn` | Cancel |
| reportModal | `#reportSendBtn` | Send report |
| feedbackModal | `close (X)` | Close |
| feedbackModal | `#feedbackCancelBtn` | Cancel |
| feedbackModal | `#feedbackSubmitBtn` | Send |
| pieceReadPagesModal | `close (X)` | Close |
| pieceReadPagesModal | `#pieceReadPagesCancel` | Cancel |
| pieceReadPagesModal | `#pieceReadPagesGo` | Read it anyway |
| pieceReadGivensModal | `close (X)` | Close |
| pieceReadGivensModal | `#pieceReadGivensTime` | 4/4 time signature at the start |
| pieceReadGivensModal | `#pieceReadGivensCancel` | Cancel |
| pieceReadGivensModal | `#pieceReadGivensGo` | Read it again |
| promptModal | `close (X)` | Close |
| promptModal | `prompt-close` | Cancel |
| promptModal | `#promptActionBtn` | Save |
| editModal | `close (X)` | Close |
| editModal | `#saveEditBtn` | Update record |
| editModal | `hide-modal(editModal)` | Cancel |
| top bar | `#toastUndoBtn` | Undo |
| top bar | `close-toast(toastSuccess)` | X |
| top bar | `close-toast(toastWarning)` | X |
| top bar | `close-toast(toastInfo)` | X |
| top bar | `#toastUndoActionBtn` | Undo |
| top bar | `close-toast(toastUndo)` | X |
| renderOfflineList() | `data-offline-remove` | Remove |
| renderNotificationsUpdateCard() | `#notificationsReloadBtn` | Reload now |
| renderNotificationsUpdateCard() | `data-notifications-home` | Start practising |
| renderNotificationsView() | `data-notification-id` |  |
| renderNotificationsView() | `data-notification-clear` |  |
| renderNotificationsView() | `data-notification-report` | Report this notice |
| renderClearedList() | `data-notification-restore` | Restore |
| renderInstrumentChoice() | `data-instrument-id` |  |
| renderHiddenBands() | `data-band-show` | Show again |
| renderInvite() | `data-resend-invite` | Send again |
| renderInvite() | `data-cancel-invite` |  |
| renderBuild() | `data-slot` | …–… …</ |
| renderBuild() | `data-add` |  |
| openChooser() | `data-opt` |  |
| openChooser() | `data-extra` |  |
| renderPickList() | `data-pick-row` |  |
| renderPickList() | `data-pick-all` | Select all |
| renderPickList() | `data-pick-none` | Unselect all |
| newPracticeList() | `data-owner` | Just me Only you see it |
| newPracticeList() | `data-owner` | … Everyone in the band will see it |
| renderFilterBar() | `data-filter-open` |  |
| renderFilterBar() | `data-filter-clear` | Clear all |
| renderFilterBar() | `data-filter-chip` |  |
| filterPanelHtml() | `data-filter-pick` |  |
| filterClearAllHtml() | `data-filter-clear-all` | Clear all |
| drawPanel() | `data-filter-back` |  |
| drawPanel() | `data-filter-back` | Done - show … |
| openSearchChoiceModal() | `data-search-idx` |  |
| openSearchChoiceModal() | `data-search-other` |  |
| pieceReadPagesShow() | `data-page-turn` | Turn it |
| pieceReadPagesShow() | `data-page-retake` | Retake |
| pieceReadPagesShowLook() | `data-page-again` | Choose the PDF again |
| pieceReadPagesShowLook() | `data-page-add` | Add the missing page |
| pieceReadPagesShowLook() | `data-page-retake` | Retake |
