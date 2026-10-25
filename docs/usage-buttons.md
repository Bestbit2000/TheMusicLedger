# Every button, grouped by tool (ML-22)

**Made by `node scripts/usage-buttons.mjs` - don't edit it by hand.** What counts as a use, and how a tap is
counted, is in [usage-stats.md](usage-stats.md) ("Every button").

885 buttons: 885 have a name a tap can be counted by, 0 need one.
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
| Add a piece | 7 | 0 |
| Recordings | 6 | 0 |
| Practice lists | 16 | 0 |
| Home and All tools | 21 | 0 |
| Stats | 25 | 0 |
| Instrument support | 11 | 0 |
| Set-up | 5 | 0 |
| My bands | 25 | 0 |
| My account, instruments, settings | 58 | 0 |
| Signing in | 15 | 0 |
| Menu, notices and the rest | 99 | 0 |

## Practice session

| Where | Counted as | Words on it |
|---|---|---|
| top bar | `#sessionBar` | Block 1 of 1 5:00 |
| sessionLengthView | `#sessSameBtn` | replay Same as last time chevron_right |
| sessionLengthView | `#sessLenMinus` | 5 minutes less |
| sessionLengthView | `#sessLenPlus` | + |
| sessionLengthView | `#sessToPlanBtn` | Next: what kind of practice |
| sessionPickView | `data-step-back=sessionLengthView` | check How long |
| sessionPickView | `#sessPlanBtn` | Standard plan |
| sessionPickView | `#sessToContentBtn` | Next: what's in it |
| sessionBuildView | `#sessBuildSurpriseBtn` | Surprise me |
| sessionBuildView | `#sessBuildClearBtn` | Clear |
| sessionBuildView | `#sessBuildSaveBtn` | Save my plan and use it |
| sessionBuildView | `#sessBuildDeleteBtn` | Delete this plan |
| sessionContentView | `data-step-back=sessionLengthView` | check How long |
| sessionContentView | `data-step-back=sessionPickView` | check What kind |
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
| prepareRunView | `#prepPlayBtn` | play_arrow Play it through |
| prepareRunView | `#prepSkipBtn` | Skip play through and set the level directly |
| levelsPaintView | `#paintTypeBtn` | Type bars instead |
| levelsPaintView | `data-paint-tool=brush` | touch_app Fill bar |
| levelsPaintView | `data-paint-tool=section` | format_color_fill Fill section |
| levelsPaintView | `data-paint-tool=all` | auto_awesome Fill all |
| levelsPaintView | `data-paint-tool=range` | arrow_range Range |
| levelsPaintView | `data-paint-tool=rubber` | ink_eraser Remove level |
| levelsPaintView | `#paintUndoBtn` | undo Undo |
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
| sessPlanModal | `#sessPlanMenuChange` | edit Change |
| sessPlanModal | `#sessPlanMenuDelete` | delete Delete |
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
| top bar | `#sessionHistoryItemEdit` | edit Edit |
| top bar | `#sessionHistoryItemDelete` | delete Delete |
| renderPrepareList() | `data-prepare-id` | … … bar${f.totalBars === 1 ? '' : ' |
| renderPathThrough() | `data-through` | … … |
| paintBarHtml() | `data-bar` | … … |
| renderPaint() | `data-pot` | … |
| renderPaintTypePicker() | `data-level` | … |
| renderCut() | `data-split` | Split it for me |
| openLevelRating() | `data-rate` | … |
| openLevelRating() | `data-rate` | Too fast? Back to Level … |
| openLevelRating() | `data-rate` | … |
| renderPlanPick() | `data-plan` | … … |
| renderPlanPick() | `data-plan-menu` | more_vert |
| renderSessScales() | `data-scales-all` | See all my scales |
| sessContentRowHtml() | `data-content` | … chevron_right |
| renderSessionPlan() | `data-block` | … … ${escapeHtml(blockT |
| openSessionBlockModal() | `data-opt` | … … ` : ''} |

## Metronome (Quick Play)

| Where | Counted as | Words on it |
|---|---|---|
| quickPlayView | `#qpVolumeBtn` | volume_mute |
| quickPlayView | `#qpPlayBtn` | play_arrow play |
| quickPlayView | `#qpResetBtn` | restart_alt reset |
| quickPlayView | `#qpSubdivideBtn` | 1 sub beats |
| quickPlayView | `#qpSpeedBtn` | 100% play speed |
| quickPlayView | `#qpLoadedHistoryUndoBtn` | undo |
| quickPlayView | `#qpLoadedHistoryClearBtn` | Clear loaded history and reset |
| quickPlayView | `#qpAddBlockBtn` | + Add bar |
| quickPlayView | `#qpBarMenuMoveUp` | arrow_upward Move up |
| quickPlayView | `#qpBarMenuMoveDown` | arrow_downward Move down |
| quickPlayView | `#qpBarMenuDuplicate` | content_copy Duplicate |
| quickPlayView | `#qpBarMenuDelete` | delete Delete |
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
| qpVolumeModal | `#qpMuteBtn` | volume_up |
| qpHistoryModal | `close (X)` | Close |
| qpHistoryModal | `#qpHistoryCloseBtn` | Close |
| qpHistoryModal | `#qpHistoryLoadBtn` | Load |
| qpMergeBarsModal | `close (X)` | Close |
| qpMergeBarsModal | `#qpMergeBarsCancelBtn` | Cancel |
| qpMergeBarsModal | `#qpMergeBarsSaveBtn` | Save to flow |
| top bar | `#qpHistoryItemRename` | drive_file_rename_outline Rename |
| top bar | `#qpHistoryItemDuplicate` | content_copy Duplicate |
| top bar | `#qpHistoryItemFavoriteToggle` | star Set as favourite |
| top bar | `#qpHistoryItemDelete` | delete Delete |
| qpBlockBoxHtml() | `data-qp-grab-handle` | drag_indicator |
| qpBlockBoxHtml() | `data-qp-menu-btn` | more_vert |
| qpBlockBoxHtml() | `data-qp-timesig-btn` | … time |
| qpBlockBoxHtml() | `data-qp-note-btn` | … beat note |
| qpBlockBoxHtml() | `data-qp-bpm-minus` | Decrease beats per minute |
| qpBlockBoxHtml() | `data-qp-bpm-plus` | + |
| qpOpenNotePicker() | `data-note` | … |
| renderQpMergeGroupHtml() | `data-qp-merge-split` | link |
| renderQpMergeGroupHtml() | `data-qp-merge-toggle-menu` | call_split |
| renderQpMergeGroupHtml() | `data-qp-merge-into` | Merge above |
| renderQpMergeGroupHtml() | `data-qp-merge-into` | Merge below |
| renderQpHistoryList() | `data-qp-history-menu-btn` | more_vert |
| loadQuickPlayPlaybackSpeeds() | `data-value` | …% |

## Tuner

| Where | Counted as | Words on it |
|---|---|---|
| tunerView | `#tunerSettingsBtn` | settings |
| tunerView | `#tunerRetryBtn` | Try again |
| tunerView | `#tunerPauseBtn` | pause |
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
| tuningForkView | `#forkPlayBtn` | play_arrow play |
| tuningForkView | `#forkMuteBtn` | volume_up |
| tuningForkView | `#forkUsualBtn` | Back to the usual tuning note |

## Timer

| Where | Counted as | Words on it |
|---|---|---|
| top bar | `#timerInlineCloseBtn` | Close |
| top bar | `#timerInlinePickBtn` | Pick minutes |
| top bar | `#timerInlinePlayBtn` | play_arrow start |
| top bar | `#timerInlineStopBtn` | stop stop |
| timerView | `#timerStartBtn` | Start |
| timerView | `#timerPlayBtn` | pause |
| timerView | `#timerStopBtn` | stop |
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
| warmupsVolumeModal | `#warmupsMuteBtn` | volume_up |
| warmupsView | `#warmupsChooseBtn` | Warm-ups expand_more |
| warmupsView | `#warmupsSettingsBtn` | tune settings |
| warmupsView | `#warmupsPrevBtn` | skip_previous previous |
| warmupsView | `#warmupsNextMainBtn` | Next warm-up skip_next |
| warmupsView | `#warmupsPlayBtn` | play_arrow Play |
| warmupsView | `#warmupsCountIn` | 4 get ready |
| warmupsView | `#warmupsNextBtn` | skip_next next |
| warmupListModal | `#warmupListCloseBtn` | Close |
| warmupListModal | `#warmupListSaveBtn` | Save |
| warmupListModal | `#warmupListDeleteBtn` | Delete this list |
| renderWarmupLists() | `data-warmup-edit` | ` : ' '} … … <span cla |
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
| scalesVolumeModal | `#scalesMuteBtn` | volume_up |
| scalesPoolModal | `data-modal-close` | Close |
| scalesPoolModal | `#scalesSeeRangeBtn` | See your range |
| scalesPoolModal | `data-modal-close` | Done |
| scalesChooseModal | `data-modal-close` | Close |
| scalesChooseModal | `#scalesChooseEditBtn` | Change your scales |
| scalesMyRangeModal | `data-modal-close` | Close |
| scalesMyRangeModal | `#scalesMyRangeSetBtn` | Set your range |
| scalesMyRangeModal | `data-modal-close` | Done |
| scalesView | `#scalesChooseBtn` | C major scale expand_more |
| scalesView | `#scalesLadderLevelBtn` | 1 level |
| scalesView | `#scalesSettingsBtn` | tune settings |
| scalesView | `#scalesLevelLink` | Level 1 - change |
| scalesView | `#scalesPrevBtn` | skip_previous previous |
| scalesView | `#scalesNotYetBtn` | replay not yet |
| scalesView | `#scalesNextMainBtn` | Next scale skip_next |
| scalesView | `#scalesPlayBtn` | play_arrow Play |
| scalesView | `#scalesCountIn` | 4 get ready |
| scalesView | `#scalesNextBtn` | skip_next next |
| scalesView | `#scalesGotItBtn` | check got it |
| scalesTile() | `data-option` | … … ` : ''} |
| scalesRenderChoose() | `data-pick` | … … |

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
| renderTheoryList() | `data-quiz` | … … ${escapeHtml |
| renderTheoryList() | `data-quiz` | … … … |
| theoryOptionBox() | `data-theory-opt` | … … |
| renderTheoryPlayed() | `data-set` | … … ` : ''}… · played ${theoryTim |
| renderTheoryPlayed() | `#theoryPlayedMoreBtn` | Show more |
| theoryNextQuestion() | `data-id` | … |
| theoryNextQuestion() | `data-id` | … |
| theoryNextQuestion() | `data-id` | … |

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
| earPlayView | `#earReplayBtn` | replay Play again |
| earPlayView | `#earSkipBtn` | Skip |
| earPlayView | `#earNextBtn` | Next note |
| drillResultsView | `smartlearn-more` | Learn more |
| drillResultsView | `#drillAgainBtn` | Again |
| drillResultsView | `#drillChangeBtn` | Change options |
| drillResultsView | `#drillOtherBtn` | Another skill |
| drillResultsView | `#drillHomeBtn` | Home |
| skillsAddModal | `#skillsAddCloseBtn` | Close |
| skillsAddModal | `#skillsAddDoneBtn` | Add |
| renderToolResults() | `data-tool-view` | ${escapeH |
| renderSkills() | `data-skill-list` | … |
| renderSkills() | `#skillListNewBtn` | + New list |
| renderSkills() | `data-skill-remove` | close |
| renderDrillOptions() | `data-drill-opt` | … … |
| renderDrillPlayed() | `data-set` | … … ` : ''}… · played ${theoryTime |
| renderDrillPlayed() | `data-more` | Show more |
| renderSkillsHub() | `data-skill-view` | … ${escapeHtml(t. |
| earShowQuestion() | `data-id` | … |
| openRhythmPicker() | `data-rhythm` | … ……` : ''}</span |

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
| metroBuilderView | `#metroBlkMiniTunerCloseBtn` | close |
| metroBuilderView | `#myMusicMenuBtn` | more_vert |
| metroBuilderView | `#flowBulkArchiveBtn` | archive Archive several pieces |
| metroBuilderView | `#flowBulkDeleteBtn` | delete Delete several pieces |
| metroBuilderView | `data-music-tab=pieces` | Pieces |
| metroBuilderView | `data-music-tab=lists` | Practice lists |
| metroBuilderView | `data-new-list` | + New practice list |
| metroBuilderView | `#myMusicAddBtn` | + Add a piece |
| metroBuilderView | `#flowLibraryItemMenuPlay` | play_arrow Play |
| metroBuilderView | `#flowLibraryItemMenuEdit` | edit Edit |
| metroBuilderView | `#flowLibraryItemMenuDuplicate` | content_copy Duplicate |
| metroBuilderView | `#flowLibraryItemMenuCopy` | library_add Copy to my library |
| metroBuilderView | `#flowLibraryItemMenuExport` | Export to MusicXML |
| metroBuilderView | `#flowLibraryItemMenuBandSummary` | insights Band summary |
| metroBuilderView | `#flowLibraryItemMenuArchive` | archive Archive |
| metroBuilderView | `#flowLibraryItemMenuRestore` | unarchive Restore |
| metroBuilderView | `#flowLibraryItemMenuReport` | flag Report |
| metroBuilderView | `#flowLibraryItemMenuDelete` | delete Delete |
| flowFromFileView | `#flowFromFileDropBtn` | upload_file Tap to browse score file Select a MusicXML or .mxl file MU |
| flowFromFileView | `#flowFromFileContinueBtn` | Continue to flow |
| flowDetailsHubView | `#flowEditTabDetailsBtn` | Details |
| flowDetailsHubView | `#flowEditTabBlocksBtn` | Bars |
| flowDetailsHubView | `#flowEditTabMediaBtn` | Media |
| flowDetailsHubView | `#flowAudienceBtn` | Just me who it's for |
| flowDetailsHubView | `#flowUploadRecordingBtn` | upload Upload mp3 / mp4 audio (up to 25 MB) |
| flowDetailsHubView | `#flowAddYouTubeBtn` | smart_display Add YouTube link |
| flowDetailsHubView | `#flowUploadDocumentBtn` | upload_file Upload PDF or MusicXML score (up to 25 MB) |
| flowDetailsHubView | `data-flow-layout` | 1 column |
| flowDetailsHubView | `data-flow-layout` | 2 columns |
| flowDetailsHubView | `data-flow-layout` | 4 columns |
| flowDetailsHubView | `#flowAddBlockBtn` | + Add bar |
| flowDetailsHubView | `#flowEditStickySecondaryBtn` | Add media |
| flowDetailsHubView | `#flowEditStickyActionBtn` | Add bars |
| flowDetailsHubView | `#flowEditCancelBtn` | Cancel |
| flowDetailsHubView | `#flowEditSaveBtn` | Save |
| flowPlayView | `#flowVolumeBtn` | volume_mute |
| flowPlayView | `#flowResetBtn` | restart_alt reset |
| flowPlayView | `#flowLoopBtn` | off repeat |
| flowPlayView | `#flowPlaybackBtn` | 1 level |
| flowPlayView | `#flowPlayBtn` | play_arrow play |
| flowPlayView | `#flowSubdivideBtn` | 1 sub beats |
| flowPlayView | `#flowSpeedBtn` | 100% play speed |
| flowPlayView | `#flowSessionFinishBtn` | flag finish |
| flowPlayView | `#flowPlayMenuBtn` | more_vert |
| flowPlayView | `#flowPlayMenuEditDetails` | edit_note Edit details |
| flowPlayView | `#flowPlayMenuEditFlow` | Edit bars |
| flowPlayView | `#flowPlayMenuLevels` | signal_cellular_alt My Levels |
| flowPlayView | `#flowPlayMenuCopy` | library_add Copy to my library |
| flowPlayView | `#flowPlayMenuLoadLibrary` | Load from library |
| flowPlayView | `#flowPlayMenuCreateNew` | add Create new |
| flowPlayView | `#flowPlayMenuReport` | flag Report |
| flowPlayView | `#flowMovementBtn` | all movement |
| flowPlayView | `data-flow-play-layout` | 1 column |
| flowPlayView | `data-flow-play-layout` | 2 columns |
| flowPlayView | `data-flow-play-layout` | 4 columns |
| top bar | `#flowBlockMenuDuplicate` | content_copy Duplicate |
| top bar | `#flowBlockMenuMoveUp` | arrow_upward Move up |
| top bar | `#flowBlockMenuMoveDown` | arrow_downward Move down |
| top bar | `#flowBlockMenuDelete` | delete Delete bar |
| top bar | `#flowFermataRowMenuEdit` | edit Edit |
| top bar | `#flowFermataRowMenuDelete` | delete Delete |
| top bar | `#flowRampRowMenuEdit` | edit Edit |
| top bar | `#flowRampRowMenuDelete` | delete Delete |
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
| flowRampModal | `#flowRampCustomTempoBtn` | 120 bpm edit |
| flowRampModal | `#flowRampAddBtn` | + Insert ramp into block |
| flowRampModal | `#flowRampCancelEditBtn` | Cancel |
| flowBandPickerModal | `close (X)` | Close |
| flowBandPickerModal | `#flowBandPickerConfirmBtn` | Move |
| flowBandPickerModal | `hide-modal(flowBandPickerModal)` | Cancel |
| flowYouTubeModal | `close (X)` | Close |
| flowYouTubeModal | `#flowYouTubeSaveBtn` | Add video to flow |
| flowYouTubeModal | `hide-modal(flowYouTubeModal)` | Cancel |
| clipModal | `clip-close` | Close |
| clipModal | `clip-mark(start)` | first_page Starts here |
| clipModal | `clip-nudge(start)` | 1 second back |
| clipModal | `clip-nudge(start)` | 1 second on |
| clipModal | `clip-mark(end)` | last_page Ends here |
| clipModal | `clip-nudge(end)` | 1 second back |
| clipModal | `clip-nudge(end)` | 1 second on |
| clipModal | `clip-try` | Play from the start mark |
| clipModal | `#clipClearBtn` | Use all of it |
| clipModal | `clip-save` | Done |
| clipModal | `clip-close` | Cancel |
| barMapModal | `barmap-close` | Close |
| barMapModal | `barmap-clip-mark(start)` | first_page Starts here |
| barMapModal | `barmap-clip-nudge(start)` | 1 second back |
| barMapModal | `barmap-clip-nudge(start)` | 1 second on |
| barMapModal | `#barMapPrevBtn` | Bar before |
| barMapModal | `#barMapNextBtn` | Next bar |
| barMapModal | `barmap-go` | Go |
| barMapModal | `barmap-mark` | This is bar 1 |
| barMapModal | `barmap-clip-mark(end)` | last_page Ends here |
| barMapModal | `barmap-clip-nudge(end)` | 1 second back |
| barMapModal | `barmap-clip-nudge(end)` | 1 second on |
| barMapModal | `barmap-save` | Done |
| barMapModal | `#barMapMatchBtn` | Match the piece's speeds to these marks |
| barMapModal | `barmap-close` | Cancel |
| flowSubdivideModal | `hide-modal(flowSubdivideModal)` | Close |
| flowSubdivideModal | `#flowSubdivideMinus` | Decrease sub beats |
| flowSubdivideModal | `#flowSubdividePlus` | + |
| flowSubdivideModal | `#flowSubdivideCancelBtn` | Cancel |
| flowSubdivideModal | `#flowSubdivideSaveBtn` | Save |
| flowBulkDeleteModal | `close (X)` | Close |
| flowBulkDeleteModal | `#flowBulkDeleteDoneBtn` | Delete |
| flowBulkArchiveModal | `close (X)` | Close |
| flowBulkArchiveModal | `#flowBulkArchiveDoneBtn` | Archive |
| outlineExtraModal | `close (X)` | Close |
| outlineExtraModal | `#outlineExtraSaveBtn` | Add it |
| outlineExtraModal | `#outlineExtraRemoveBtn` | Remove this extra |
| flowSpeedModal | `hide-modal(flowSpeedModal)` | Close |
| flowVolumeModal | `#flowVolumeCloseBtn` | Close |
| flowVolumeModal | `#flowVolumeMinus` | Decrease volume |
| flowVolumeModal | `#flowVolumePlus` | + |
| flowVolumeModal | `#flowMuteBtn` | volume_up |
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
| listItemModal | `#liActionBtn` | delete |
| flowCheckModal | `#flowCheckCloseBtn` | Close |
| flowCheckModal | `#flowCheckFixBtn` | Go back and fix |
| flowCheckModal | `#flowCheckContinueBtn` | Save anyway |
| renderRehearseList() | `data-rehearse-id` | … … bar${f.totalBars === 1 ? '' : ' |
| renderFlowPlaybackModal() | `pb-option` | … |
| renderFlowPlaybackModal() | `data-pb-level` | … … |
| renderFlowsList() | `data-flow-library-menu-btn` | more_vert |
| flowMediaItemHtml() | `rec-map` | … · … start, bars and end |
| flowMediaItemHtml() | `flow-speeds-restore` | Put the original speeds back |
| flowMediaItemHtml() | `flow-recording-clip` | … start and end |
| flowMediaItemHtml() | `flow-recording-movement` | … movement |
| flowMediaItemHtml() | `flow-recording-delete` | delete |
| renderFlowRecordingsList() | `flow-speeds-restore` | Put the original speeds back |
| renderFlowDocumentsList() | `open-url` | visibility |
| renderFlowDocumentsList() | `flow-document-delete` | delete |
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
| flowBlockMarkBoxHtml() | `data-block-tile=rehearsalMark` | … |
| flowBlockMarkBoxHtml() | `data-block-tile=rehearsalMark` | + RM |
| flowBlockCardHtml() | `data-block-grab-handle` | drag_indicator |
| flowBlockCardHtml() | `data-block-menu-btn` | more_vert |
| renderFlowBarGrid() | `data-block-id` | … |
| flowBarFullTileHtml() | `flow-jump` | … … … <span class="flow-bar-full-row |
| flowLeadInPlayTileHtml() | `flow-jump` | `; if (layout === '2') { return `… Lead-in |
| flowBarDetailTileHtml() | `flow-jump` | ` : ` `; const warning = f |
| flowBarDetailTileHtml() | `data-block-id` | `; const warning = flowRepeatBarInvalid(b) \|\| flowIntroInval |
| renderFlowBarPopup() | `data-bar-popup=prev` | … |
| renderFlowBarPopup() | `data-bar-popup=next` | … |
| renderFlowBarPopup() | `data-bar-popup=close` | … |
| renderFlowBarPopup() | `data-bar-popup=earlier` | Move earlier |
| renderFlowBarPopup() | `data-bar-popup=duplicate` | Duplicate |
| renderFlowBarPopup() | `data-bar-popup=later` | Move later |
| renderFlowBarPopup() | `data-bar-popup=delete` | Delete this bar |
| openFlowChoiceModal() | `data-choice-idx` | … `} ${opt.selected && !opt.html ? ' check |
| renderFlowRepeatBarModal() | `data-pass` | … |
| flowOpenNotePicker() | `data-note` | … |
| flowOpenBarStartPicker() | `data-start-option` | … |
| flowBarlinePickerTileHtml() | `data-option` | … ${o.countLabel ? `<span class="flow-picker-tile-cou |
| flowGlyphPickerTileHtml() | `data-option` | … … |
| renderFlowFermataList() | `data-pause-edit` | … Bar …, beat ${flowPauseBeatNu |
| renderFlowFermataList() | `data-pause-menu` | more_vert |
| renderFlowFermataAddSection() | `data-pause-kind` | … … … </button |
| renderFlowRampList() | `data-ramp-edit` | … |
| renderFlowRampList() | `data-ramp-menu` | more_vert |
| renderFlowRampAddSection() | `data-ramp-target` | … … |
| flowShowCheckReview() | `data-check-block` | … |
| recScoreControlsHtml() | `rec-loop` | off repeat |
| recScoreControlsHtml() | `rec-play` | play_arrow play |
| recScoreControlsHtml() | `rec-speed` | 100% play speed |
| renderBarMapModal() | `barmap-play` | Play |
| renderBarMapModal() | `barmap-remove` | Remove |
| renderFlowMediaDots() | `data-slide-index` | … |
| renderFlowLoopModal() | `data-rest` | … |
| loadFlowPlaybackSpeeds() | `data-value` | …% |
| renderMetroSegTimeSigPicker() | `data-value` | … |
| renderMetroSegTimeSigChips() | `data-value` | … |
| renderMetroSegTimeSigChips() | `data-remove-id` | Archive ${escapeHtml(t.label)} |
| renderMetroSegCustomSigManageList() | `timesig-delete` | delete |
| renderMetroSegCustomSigManageList() | `timesig-archive` | Archive |
| renderMetroBlkMiniTunerInstrumentOptions() | `data-value` | … |
| renderOutline() | `data-outline=back` | Back |
| renderOutline() | `data-outline` | … |
| outlineValueBtn() | `data-outline` | … … |
| outlineTile() | `data-outline` | … … |
| outlinePickNote() | `data-note` | … |
| outlineTimeRowHtml() | `data-time-pick` | list |
| outlineSpeedRowHtml() | `data-speed-note` | … |
| outlineTableRowHtml() | `data-xkind` | … |
| outlineTableRowHtml() | `data-xends` | … |
| outlineExtrasStepHtml() | `data-outline-extra` | … …</stron |
| outlineExtrasStepHtml() | `data-outline=addExtra` | + … |
| outlineMediaStepHtml() | `data-outline-media-remove` | … … <span class="text-sm |
| outlineMediaStepHtml() | `data-outline=addVideo` | + Add the link |
| outlineMediaStepHtml() | `data-outline=pickFile` | + … |
| renderOutlineExtraForm() | `data-x-sign` | … … |
| renderOutlineEndingsForm() | `data-ends-add` | + Add another ending |
| outlineReadPanelHtml() | `data-outline=readChecks` | photo_camera Read from your …: ${pieceReadLevelWord(read. |

## Add a piece

| Where | Counted as | Words on it |
|---|---|---|
| addPieceView | `#addPieceOwnerBtn` | Just me who it's for |
| addPieceView | `#addPieceListBtn` | On its own practice list |
| addPieceView | `#metroBlkEntryCreateBtn` | add_circle Create your own Put the bars in yourself |
| addPieceView | `#metroBlkEntryQuickBtn` | bolt Quick entry Bars and marks first, then what's different |
| addPieceView | `#metroBlkEntryPhotoBtn` | photo_camera From a photo or PDF Uses AI to import the piece |
| addPieceView | `#metroBlkEntryFromFileBtn` | upload_file Import from MusicXML Open a MusicXML or .mxl file from not |
| addPieceNewListForm() | `#addPieceNewListSaveBtn` | Save |

## Recordings

| Where | Counted as | Words on it |
|---|---|---|
| recordingsView | `#recordingsUploadBtn` | upload Upload a rehearsal recording |
| recordingsView | `#recordingsYouTubeBtn` | smart_display Add a YouTube video |
| renderRecordings() | `recordings-cut-change` | Change |
| renderRecordings() | `recordings-cut-remove` | Remove |
| renderRecordings() | `recordings-give` | library_add Give it to a piece |
| renderRecordings() | `recordings-delete` | Delete this recording |

## Practice lists

| Where | Counted as | Words on it |
|---|---|---|
| practiceListView | `#plDateBtn` | None target date |
| practiceListView | `#plWeekBtn` | None a week |
| practiceListView | `#plMinsBtn` | None minutes |
| practiceListView | `#plWarmBtn` | None warm-up |
| practiceListView | `#plPieceMenuMovement` | segment Which movement |
| practiceListView | `#plPieceMenuLevels` | signal_cellular_alt Prepare levels |
| practiceListView | `#plPieceMenuDelete` | delete Delete |
| practiceListView | `#plAddPiecesBtn` | + Add pieces |
| practiceListView | `#plPlanBtn` | Plan a session for this |
| practiceListView | `#plArchiveBtn` | Archive this list |
| practiceListView | `#plReportBtn` | Report this list |
| practiceListView | `#plClearRecordingsBtn` | Delete this list's recordings |
| practiceListView | `#plDeleteBtn` | Delete this list |
| renderPracticeListRows() | `data-list` | … … · ` : ''}… · ${l.pieceCount |
| renderPracticeList() | `data-piece` | … … ${pb.archived ? '' : pb.prep ? '<span class="text-sm |
| renderPracticeList() | `data-piece-menu` | more_vert |

## Home and All tools

| Where | Counted as | Words on it |
|---|---|---|
| mainView | `#homeAvatar` | Your avatar - change it in My details |
| mainView | `#startPracticeSessionBtn` | Start a practice session |
| mainView | `view(entryForm)` | Log time you've already played |
| mainView | `view(toolsView)` | apps All tools chevron_right |
| toolsView | `view(quickPlayView)` | Metronome |
| toolsView | `view(tunerView)` | Tuner |
| toolsView | `view(timerView)` | timer Timer |
| toolsView | `#tuningForkToolBtn` | sensors Tuning fork |
| toolsView | `#warmupsToolBtn` | wb_twilight Warm-ups |
| toolsView | `#scalesToolBtn` | Scales |
| toolsView | `#addPieceToolBtn` | library_add Add a piece |
| toolsView | `#prepareToolBtn` | construction Prepare |
| toolsView | `#rehearseToolBtn` | Rehearse |
| toolsView | `#recordingsToolBtn` | graphic_eq Recordings |
| toolsView | `#theoryToolBtn` | Theory |
| toolsView | `#skillsToolBtn` | fitness_center Skills |
| toolsView | `#rangeToolBtn` | height Range |
| toolsView | `#toolsEditBtn` | Choose favourite tools |
| top bar | `#homeToolMenuEarlier` | arrow_back Move earlier |
| top bar | `#homeToolMenuLater` | arrow_forward Move later |
| top bar | `#homeToolMenuRemove` | star Remove from favourites |

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
| renderHistoryList() | `data-session-history-menu-btn` | more_vert |

## Instrument support

| Where | Counted as | Words on it |
|---|---|---|
| top bar | `#instrumentSupportNavItem` | handyman Instrument support |
| instrumentSupportView | `#supportNearBtn` | My bands' towns near |
| instrumentSupportView | `#supportForBtn` | Everything looking for |
| instrumentSupportView | `feedback` | Something wrong or missing? Tell us |
| supportBusinessModal | `close (X)` | Close |
| supportTownModal | `close (X)` | Close |
| supportRowHtml() | `data-support-id` | … ${escape |
| openSupportBusiness() | `data-support-open=link` | … |
| openSupportBusiness() | `data-support-open=phone` | Call … |
| openSupportBusiness() | `data-support-open=email` | Email … |
| searchSupportTowns() | `data-town` | … |

## Set-up

| Where | Counted as | Words on it |
|---|---|---|
| setupValueBox() | `data-setup` | … … |
| setupBandsHtml() | `data-setup=band` | + … |
| renderSetup() | `data-setup=back` | Back |
| renderSetup() | `data-setup=next` | …` : 'Finish'} |
| setupPickBand() | `#setupNewBandAdd` | Add it |

## My bands

| Where | Counted as | Words on it |
|---|---|---|
| accountBandsView | `#tidyBandsLink` | checklist Tidy my bands chevron_right |
| accountBandsView | `#accountJoinBandBtn` | Add |
| accountBandsView | `#accountAddBandToggleBtn` | Can't find your band? Add it |
| accountBandsView | `#accountAddBandBtn` | Add |
| bandWelcomeView | `#bandWelcomeJoinBtn` | Join the band |
| bandWelcomeView | `#bandWelcomeLaterBtn` | Not now |
| bandMembersView | `#bandNoticeSendBtn` | Send to the band |
| bandMembersView | `#bandLogoBtn` | Add a logo |
| bandMembersView | `#bandLogoRemoveBtn` | Take the logo off |
| bandMembersView | `#bandInviteLevelBtn` | Can play what they can do |
| bandMembersView | `#bandInviteBtn` | Invite |
| top bar | `#accountBandMenuShare` | group_add Set up sharing |
| top bar | `#accountBandMenuMembers` | group Members |
| top bar | `#accountBandMenuLeave` | Leave shared band |
| top bar | `#accountBandMenuDirectory` | link It's a band in the list |
| top bar | `#accountBandMenuMerge` | merge Same as another of mine |
| top bar | `#accountBandMenuHide` | visibility_off I don't play with them now |
| top bar | `#accountBandMenuReport` | flag Report the name |
| top bar | `#accountBandMenuDelete` | delete Stop sharing |
| renderAccountBandInvites() | `data-invite-accept` | Join … |
| renderAccountBandInvites() | `data-invite-decline` | No thanks |
| renderAccountBandsList() | `data-band-menu-id` | more_vert |
| renderTidyBands() | `data-tidy-band` | … … - tap to say what it is |
| renderBandMembers() | `data-member` | … … |
| renderBandMembers() | `data-invite` | … … invited ${escapeHtml(new Date(i.sentAt).toLocaleDateStri |

## My account, instruments, settings

| Where | Counted as | Words on it |
|---|---|---|
| settingsView | `view(settingsDisplayView)` | contrast Display and reading chevron_right |
| settingsView | `view(settingsStatsView)` | bar_chart Stats chevron_right |
| settingsView | `view(settingsTunerView)` | Tuner chevron_right |
| settingsView | `view(settingsPlaybackView)` | Metronome playback chevron_right |
| settingsView | `#settingsNoticesLink` | notifications Notifications Which notices the app sends you chevron_ri |
| settingsView | `#settingsSetupLink` | checklist Set up again What I play, how it looks, who I play with chev |
| settingsDisplayView | `#displayResetBtn` | Reset to standard |
| settingsPlaybackView | `#metroCalibLatencyMinusBtn` | Less delay |
| settingsPlaybackView | `#metroCalibLatencyPlusBtn` | + |
| settingsPlaybackView | `#metroCalibPlayBtn` | play_arrow test |
| settingsPlaybackView | `#metroCalibLatencyResetBtn` | restart_alt reset |
| accountView | `view(accountDetailsView)` | badge My details chevron_right |
| accountView | `#accountSecurityRow` | lock Sign-in and security chevron_right |
| accountView | `view(accountBandsView)` | groups My bands chevron_right |
| accountView | `#accountTeachersRow` | school My teachers chevron_right |
| accountDetailsView | `#accountEditNameBtn` | Name - edit , edit |
| accountDetailsView | `#accountEditDisplayNameBtn` | Display name - edit , edit |
| accountDetailsView | `#accountEditAvatarBtn` | Avatar edit , change |
| accountDetailsView | `#accountEditEmailBtn` | Email edit , change |
| accountDetailsView | `#accountExportBtn` | download Download my information |
| accountDetailsView | `#accountDeleteBtn` | Delete my account |
| accountInstrumentsView | `#accountAddInstrumentBtn` | Add |
| accountInstrumentsView | `#supportFromInstrumentsLink` | handyman Need a repair, a shop or hire? Instrument support - near your |
| accountTeachersView | `list-add(teachers)` | Add |
| top bar | `#accountInstrumentMenuMain` | star Make main instrument |
| top bar | `#accountInstrumentMenuRange` | height My range |
| top bar | `#accountInstrumentMenuClef` | music_note My clef |
| top bar | `#accountInstrumentMenuRemove` | remove_circle Remove |
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
| renderSettingsList() | `list-edit` | edit |
| renderAccountInstruments() | `data-instrument-menu-id` | more_vert |
| renderTwoStepSetup() | `data-two-step-open` | Add to my authenticator app |
| renderTwoStepSetup() | `data-two-step-copy-key` | Copy the setup key |
| renderTwoStepSetup() | `data-two-step-confirm` | Turn on two-step sign-in |
| renderRecoveryCodes() | `data-codes-copy` | Copy the codes |
| renderRecoveryCodes() | `data-codes-done` | I've saved them |
| renderPasswordPanel() | `#accountPasswordOpenBtn` | Change password |
| renderPasswordPanel() | `#accountPasswordOpenBtn` | Add a password |
| renderPasswordPanel() | `#accountPasswordSaveBtn` | Save |
| renderPasswordPanel() | `#accountPasswordCancelBtn` | Cancel |
| renderAccountSecurity() | `#accountTwoStepStartBtn` | Set up two-step sign-in |
| renderAccountSecurity() | `#accountNewCodesBtn` | New recovery codes |
| renderAccountSecurity() | `#accountTwoStepOffBtn` | Turn off two-step sign-in |
| renderAccountSecurity() | `#accountTwoStepConfirmBtn` | Confirm |
| renderAccountSecurity() | `#accountTwoStepCancelBtn` | Cancel |
| renderAvatarGrid() | `data-avatar` | …)} … |

## Signing in

| Where | Counted as | Words on it |
|---|---|---|
| top bar | `#loginBtn` | Sign in with Google |
| top bar | `data-password-toggle=loginPassword` | visibility |
| top bar | `#passwordLoginSubmit` | Log in |
| top bar | `#forgotLinkBtn` | Forgot your password? |
| top bar | `#forgotSubmit` | Send the link |
| top bar | `#forgotBackBtn` | Back to log in |
| top bar | `#emailChangeConfirmBtn` | Change my email address |
| top bar | `#emailChangeBackBtn` | Not now |
| top bar | `data-password-toggle=setPassword` | visibility |
| top bar | `data-password-toggle=setPasswordConfirm` | visibility |
| top bar | `#setPasswordSubmit` | Save and log in |
| top bar | `#setPasswordLoginLink` | Go to log in |
| top bar | `#twoStepSubmit` | Continue |
| top bar | `#twoStepRecoveryBtn` | Use a recovery code instead |
| passwordFieldHtml() | `data-password-toggle` | visibility |

## Menu, notices and the rest

| Where | Counted as | Words on it |
|---|---|---|
| noticeBannerModal | `close (X)` | Close |
| top bar | `data-notice-banner-open` | Notice |
| top bar | `data-notice-banner-close` | close |
| top bar | `#topBackBtn` |  |
| top bar | `#topTunerToggleBtn` | Show tuner |
| top bar | `#topTimerPill` | timer 00:00 left |
| top bar | `#topTimerIconBtn` | timer |
| top bar | `#navBurgerMenuBtn` | ☰ |
| top bar | `#navRailFoldBtn` | menu_open |
| top bar | `view-menu(mainView)` | home Home |
| top bar | `#notificationsNavItem` | notifications Notifications |
| top bar | `#navToolsBtn` | apps Tools chevron_right |
| top bar | `view-menu(statsHomeView)` | bar_chart Stats |
| top bar | `#myMusicNavItem` | library_music My music |
| top bar | `view-menu(settingsView)` | settings My app settings |
| top bar | `view-menu(accountInstrumentsView)` | music_note My instruments |
| top bar | `#inviteNavItem` | person_add Invite someone |
| top bar | `#feedbackNavItem` | chat Send feedback |
| top bar | `view-menu(aboutView)` | info About |
| top bar | `view-menu(accountView)` | person My account |
| top bar | `logout` | logout Log out |
| top bar | `#navToolsBackBtn` | chevron_left Tools |
| top bar | `data-notice-banner-open` | Notice |
| top bar | `data-notice-banner-close` | close |
| top bar | `reload` | Reload |
| top bar | `#updateBannerMore` | See what's new |
| top bar | `#updateBannerClose` | close |
| top bar | `#offlineBarBtn` | See them |
| top bar | `#previewStopBtn` | Stop previewing |
| notificationsView | `#notificationsMarkAllBtn` | Mark all as read |
| notificationsView | `#notificationsClearAllBtn` | Clear all |
| notificationsView | `#notificationsClearedBtn` | Show cleared |
| inviteView | `#inviteLevelBtn` | Standard member account type |
| inviteView | `#inviteSendBtn` | Send invite |
| aboutView | `view(aboutReleasesView)` | history Release history What changed in each version chevron_right |
| aboutView | `about-policy(privacy)` | shield_person Privacy policy What we hold about you, and how to delete |
| aboutView | `about-policy(terms)` | gavel Terms of use The terms for using the app chevron_right |
| aboutView | `view(aboutGradesView)` | school Exam grades Where the grade lists come from chevron_right |
| importantNoticeModal | `#importantNoticeOkBtn` | Got it |
| urgentNotificationModal | `#urgentNotificationOkBtn` | Got it |
| whatsNewModal | `close (X)` | Close |
| whatsNewModal | `reload` | Reload now |
| policyModal | `close (X)` | Close |
| top bar | `#submitBtn` | Save session |
| top bar | `#cancelAddBtn` | Cancel |
| levelRateModal | `#levelRateCloseBtn` | Close without answering |
| levelRateModal | `#levelRateMoreBtn` | Move up even further |
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
| renderNotificationsView() | `data-notification-id` | … … ${n.important ? '<span cl |
| renderNotificationsView() | `data-notification-clear` | close |
| renderNotificationsView() | `data-notification-report` | Report this notice |
| renderClearedList() | `data-notification-restore` | Restore |
| renderInstrumentChoice() | `data-instrument-id` | … … |
| renderHiddenBands() | `data-band-show` | Show again |
| renderInvite() | `data-resend-invite` | Send again |
| renderInvite() | `data-cancel-invite` | … |
| renderBuild() | `data-slot` | …–… …</ |
| renderBuild() | `data-add` | … … |
| openChooser() | `data-opt` | … … ` : ''} |
| openChooser() | `data-extra` | … |
| renderPickList() | `data-pick-row` | … |
| renderPickList() | `data-pick-all` | Select all |
| renderPickList() | `data-pick-none` | Unselect all |
| newPracticeList() | `data-owner` | Just me Only you see it |
| newPracticeList() | `data-owner` | … Everyone in the band will see it |
| renderFilterBar() | `data-filter-open` | filter_list … <span class="metroBlk-ctrl- |
| renderFilterBar() | `data-filter-clear` | Clear all |
| renderFilterBar() | `data-filter-chip` | … close |
| filterPanelHtml() | `data-filter-pick` | …… … |
| filterClearAllHtml() | `data-filter-clear-all` | Clear all |
| drawPanel() | `data-filter-back` | arrow_back … |
| drawPanel() | `data-filter-back` | Done - show … |
| openSearchChoiceModal() | `data-search-idx` | … `}…</butt |
| openSearchChoiceModal() | `data-search-other` | … |
