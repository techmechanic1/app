import { confirmDialog } from '@/services/alertService';
import { KeyboardModifier } from '@/services/ioService';
import { StringEmptyTrash, Strings, StringUtils } from '@/strings';
import { MENU_MARGIN_FROM_APP_BORDER } from '@/constants';
import {
  UuidString,
  SNNote,
  NoteMutator,
  ContentType,
  SNTag,
  ChallengeReason,
  NoteViewController,
  ApplicationEvent,
  Uuids,
} from '@standardnotes/snjs';
import {
  makeObservable,
  observable,
  action,
  computed,
  runInAction,
  autorun,
} from 'mobx';
import { WebApplication } from '../application';
import { AppState } from './app_state';

const PersistKey = 'notes-state';
interface NotesStatePersistable {
  selectedNoteIds: UuidString[];
  contextMenuOpen: boolean;
  contextMenuPosition: ContextMenuPosition;
}

type ContextMenuPosition = { top?: number; left: number; bottom?: number };

export class NotesState {
  lastSelectedNote: SNNote | undefined;
  selectedNotes: Record<UuidString, SNNote> = observable({});
  selectedNoteIds: Set<UuidString> = observable(new Set<UuidString>());
  contextMenuOpen = false;
  contextMenuPosition: ContextMenuPosition = {
    top: 0,
    left: 0,
  };
  contextMenuClickLocation: { x: number; y: number } = { x: 0, y: 0 };
  contextMenuMaxHeight: number | 'auto' = 'auto';
  showProtectedWarning = false;
  showRevisionHistoryModal = false;

  constructor(
    private application: WebApplication,
    private appState: AppState,
    private onActiveEditorChanged: () => Promise<void>,
    appEventListeners: (() => void)[]
  ) {
    makeObservable(this, {
      selectedNotes: observable,
      selectedNoteIds: observable,
      contextMenuOpen: observable,
      contextMenuPosition: observable,
      showProtectedWarning: observable,
      showRevisionHistoryModal: observable,

      selectedNotesCount: computed,
      trashedNotesCount: computed,

      setContextMenuOpen: action,
      setContextMenuClickLocation: action,
      setContextMenuPosition: action,
      setContextMenuMaxHeight: action,
      setShowProtectedWarning: action,
      setShowRevisionHistoryModal: action,
      unselectNotes: action,
      selectNote: action,
      setNoteAsSelected: action,
      setSelectedNotes: action,
    });

    autorun(() => {
      const value = {
        selectedNoteIds: Array.from(this.selectedNoteIds),
        contextMenuOpen: this.contextMenuOpen,
        contextMenuPosition: this.contextMenuPosition,
      };
      this.persist(value);
    });

    autorun(() => {
      if (this.selectedNotesCount === 1) {
        void this.openNote(Object.keys(this.selectedNotes)[0]);
      }
    });

    if (this.application.isLaunched()) {
      this.loadFromCache();
    } else {
      this.application.addEventObserver(async (eventName) => {
        if (eventName === ApplicationEvent.LocalDataLoaded) {
          this.loadFromCache();
        }
      });
    }

    appEventListeners.push(
      application.streamItems(ContentType.Note, (notes) => {
        runInAction(() => {
          for (const note of notes) {
            if (this.selectedNotes[note.uuid]) {
              this.setNoteAsSelected(note as SNNote);
            }
          }
        });
      })
    );
  }

  private loadFromCache() {
    const value = this.application.getValue(
      PersistKey
    ) as NotesStatePersistable;

    if (!value) {
      return;
    }

    if (value.selectedNoteIds) {
      const notes = this.application.items
        .findItems(value.selectedNoteIds)
        .filter((note) => note != undefined) as SNNote[];

      this.setSelectedNotes(notes);
    }

    this.contextMenuOpen = value.contextMenuOpen;
    this.contextMenuPosition = value.contextMenuPosition;
  }

  private persist(value: NotesStatePersistable): void {
    if (!this.application.isLaunched()) {
      return;
    }

    void this.application.setValue(PersistKey, value);
  }

  setNoteAsSelected(note: SNNote): void {
    this.selectedNotes[note.uuid] = note;
    this.selectedNoteIds.add(note.uuid);
  }

  setNoteAsUnselected(note: SNNote): void {
    delete this.selectedNotes[note.uuid];
    this.selectedNoteIds.delete(note.uuid);
  }

  setSelectedNotes(notes: SNNote[]): void {
    const selectedNotes: Record<UuidString, SNNote> = {};
    for (const note of notes) {
      selectedNotes[note.uuid] = note;
    }
    this.selectedNotes = observable(selectedNotes);
    this.selectedNoteIds = observable(new Set(Uuids(notes)));
  }

  get activeNoteController(): NoteViewController | undefined {
    return this.application.noteControllerGroup.noteControllers[0];
  }

  get selectedNotesCount(): number {
    return Object.keys(this.selectedNotes).length;
  }

  get trashedNotesCount(): number {
    return this.application.items.trashedItems.length;
  }

  private async selectNotesRange(selectedNote: SNNote): Promise<void> {
    const notes = this.application.items.getDisplayableItems(
      ContentType.Note
    ) as SNNote[];
    const lastSelectedNoteIndex = notes.findIndex(
      (note) => note.uuid == this.lastSelectedNote?.uuid
    );
    const selectedNoteIndex = notes.findIndex(
      (note) => note.uuid == selectedNote.uuid
    );

    let notesToSelect = [];
    if (selectedNoteIndex > lastSelectedNoteIndex) {
      notesToSelect = notes.slice(lastSelectedNoteIndex, selectedNoteIndex + 1);
    } else {
      notesToSelect = notes.slice(selectedNoteIndex, lastSelectedNoteIndex + 1);
    }

    const authorizedNotes =
      await this.application.authorizeProtectedActionForNotes(
        notesToSelect,
        ChallengeReason.SelectProtectedNote
      );

    for (const note of authorizedNotes) {
      runInAction(() => {
        this.setNoteAsSelected(note);
        this.lastSelectedNote = note;
      });
    }
  }

  async selectNote(uuid: UuidString, userTriggered?: boolean): Promise<void> {
    const note = this.application.items.findItem(uuid) as SNNote;
    if (!note) {
      return;
    }

    const hasMeta = this.io.activeModifiers.has(KeyboardModifier.Meta);
    const hasCtrl = this.io.activeModifiers.has(KeyboardModifier.Ctrl);
    const hasShift = this.io.activeModifiers.has(KeyboardModifier.Shift);

    if (userTriggered && (hasMeta || hasCtrl)) {
      if (this.selectedNotes[uuid]) {
        this.setNoteAsUnselected(this.selectedNotes[uuid]);
      } else if (await this.application.authorizeNoteAccess(note)) {
        runInAction(() => {
          this.setNoteAsSelected(note);
          this.lastSelectedNote = note;
        });
      }
    } else if (userTriggered && hasShift) {
      await this.selectNotesRange(note);
    } else {
      const shouldSelectNote =
        this.selectedNotesCount > 1 || !this.selectedNotes[uuid];
      if (
        shouldSelectNote &&
        (await this.application.authorizeNoteAccess(note))
      ) {
        runInAction(() => {
          this.setSelectedNotes([note]);
          this.lastSelectedNote = note;
        });
      }
    }
  }

  private async openNote(noteUuid: string): Promise<void> {
    if (this.activeNoteController?.note?.uuid === noteUuid) {
      return;
    }

    const note = this.application.items.findItem(noteUuid) as
      | SNNote
      | undefined;
    if (!note) {
      console.warn('Tried accessing a non-existant note of UUID ' + noteUuid);
      return;
    }

    if (this.activeNoteController) {
      this.application.noteControllerGroup.closeActiveNoteView();
    }

    await this.application.noteControllerGroup.createNoteView(noteUuid);

    this.appState.noteTags.reloadTags();
    await this.onActiveEditorChanged();

    if (note.waitingForKey) {
      this.application.presentKeyRecoveryWizard();
    }
  }

  setContextMenuOpen(open: boolean): void {
    this.contextMenuOpen = open;
  }

  setContextMenuClickLocation(location: { x: number; y: number }): void {
    this.contextMenuClickLocation = location;
  }

  setContextMenuPosition(position: {
    top?: number;
    left: number;
    bottom?: number;
  }): void {
    this.contextMenuPosition = position;
  }

  setContextMenuMaxHeight(maxHeight: number | 'auto'): void {
    this.contextMenuMaxHeight = maxHeight;
  }

  reloadContextMenuLayout(): void {
    const { clientHeight } = document.documentElement;
    const defaultFontSize = window.getComputedStyle(
      document.documentElement
    ).fontSize;
    const maxContextMenuHeight = parseFloat(defaultFontSize) * 30;
    const footerElementRect = document
      .getElementById('footer-bar')
      ?.getBoundingClientRect();
    const footerHeightInPx = footerElementRect?.height;

    // Open up-bottom is default behavior
    let openUpBottom = true;

    if (footerHeightInPx) {
      const bottomSpace =
        clientHeight - footerHeightInPx - this.contextMenuClickLocation.y;
      const upSpace = this.contextMenuClickLocation.y;

      // If not enough space to open up-bottom
      if (maxContextMenuHeight > bottomSpace) {
        // If there's enough space, open bottom-up
        if (upSpace > maxContextMenuHeight) {
          openUpBottom = false;
          this.setContextMenuMaxHeight('auto');
          // Else, reduce max height (menu will be scrollable) and open in whichever direction there's more space
        } else {
          if (upSpace > bottomSpace) {
            this.setContextMenuMaxHeight(upSpace - MENU_MARGIN_FROM_APP_BORDER);
            openUpBottom = false;
          } else {
            this.setContextMenuMaxHeight(
              bottomSpace - MENU_MARGIN_FROM_APP_BORDER
            );
          }
        }
      } else {
        this.setContextMenuMaxHeight('auto');
      }
    }

    if (openUpBottom) {
      this.setContextMenuPosition({
        top: this.contextMenuClickLocation.y,
        left: this.contextMenuClickLocation.x,
      });
    } else {
      this.setContextMenuPosition({
        bottom: clientHeight - this.contextMenuClickLocation.y,
        left: this.contextMenuClickLocation.x,
      });
    }
  }

  async changeSelectedNotes(
    mutate: (mutator: NoteMutator) => void
  ): Promise<void> {
    await this.application.mutator.changeItems(
      Object.keys(this.selectedNotes),
      mutate,
      false
    );
    this.application.sync.sync();
  }

  setHideSelectedNotePreviews(hide: boolean): void {
    this.changeSelectedNotes((mutator) => {
      mutator.hidePreview = hide;
    });
  }

  setLockSelectedNotes(lock: boolean): void {
    this.changeSelectedNotes((mutator) => {
      mutator.locked = lock;
    });
  }

  async setTrashSelectedNotes(trashed: boolean): Promise<void> {
    if (trashed) {
      const notesDeleted = await this.deleteNotes(false);
      if (notesDeleted) {
        runInAction(() => {
          this.unselectNotes();
          this.contextMenuOpen = false;
        });
      }
    } else {
      await this.changeSelectedNotes((mutator) => {
        mutator.trashed = trashed;
      });
      runInAction(() => {
        this.unselectNotes();
        this.contextMenuOpen = false;
      });
    }
  }

  async deleteNotesPermanently(): Promise<void> {
    await this.deleteNotes(true);
  }

  async deleteNotes(permanently: boolean): Promise<boolean> {
    if (Object.values(this.selectedNotes).some((note) => note.locked)) {
      const text = StringUtils.deleteLockedNotesAttempt(
        this.selectedNotesCount
      );
      this.application.alertService.alert(text);
      return false;
    }

    const title = Strings.trashNotesTitle;
    let noteTitle = undefined;
    if (this.selectedNotesCount === 1) {
      const selectedNote = Object.values(this.selectedNotes)[0];
      noteTitle = selectedNote.title.length
        ? `'${selectedNote.title}'`
        : 'this note';
    }
    const text = StringUtils.deleteNotes(
      permanently,
      this.selectedNotesCount,
      noteTitle
    );

    if (
      await confirmDialog({
        title,
        text,
        confirmButtonStyle: 'danger',
      })
    ) {
      if (permanently) {
        for (const note of Object.values(this.selectedNotes)) {
          await this.application.mutator.deleteItem(note);
          this.setNoteAsUnselected(this.selectedNotes[note.uuid]);
        }
      } else {
        await this.changeSelectedNotes((mutator) => {
          mutator.trashed = true;
        });
      }
      return true;
    }

    return false;
  }

  setPinSelectedNotes(pinned: boolean): void {
    this.changeSelectedNotes((mutator) => {
      mutator.pinned = pinned;
    });
  }

  async setArchiveSelectedNotes(archived: boolean): Promise<void> {
    if (Object.values(this.selectedNotes).some((note) => note.locked)) {
      this.application.alertService.alert(
        StringUtils.archiveLockedNotesAttempt(archived, this.selectedNotesCount)
      );
      return;
    }

    await this.changeSelectedNotes((mutator) => {
      mutator.archived = archived;
    });

    runInAction(() => {
      this.setSelectedNotes([]);
      this.contextMenuOpen = false;
    });
  }

  async setProtectSelectedNotes(protect: boolean): Promise<void> {
    const selectedNotes = Object.values(this.selectedNotes);
    if (protect) {
      await this.application.mutator.protectNotes(selectedNotes);
      this.setShowProtectedWarning(true);
    } else {
      await this.application.mutator.unprotectNotes(selectedNotes);
      this.setShowProtectedWarning(false);
    }
  }

  unselectNotes(): void {
    this.setSelectedNotes([]);
  }

  getSpellcheckStateForNote(note: SNNote) {
    return note.spellcheck != undefined
      ? note.spellcheck
      : this.appState.isGlobalSpellcheckEnabled();
  }

  async toggleGlobalSpellcheckForNote(note: SNNote) {
    await this.application.mutator.changeItem<NoteMutator>(
      note.uuid,
      (mutator) => {
        mutator.toggleSpellcheck();
      },
      false
    );
    this.application.sync.sync();
  }

  async addTagToSelectedNotes(tag: SNTag): Promise<void> {
    const selectedNotes = Object.values(this.selectedNotes);
    const parentChainTags = this.application.items.getTagParentChain(tag.uuid);
    const tagsToAdd = [...parentChainTags, tag];
    await Promise.all(
      tagsToAdd.map(async (tag) => {
        await this.application.mutator.changeItem(tag.uuid, (mutator) => {
          for (const note of selectedNotes) {
            mutator.addItemAsRelationship(note);
          }
        });
      })
    );
    this.application.sync.sync();
  }

  async removeTagFromSelectedNotes(tag: SNTag): Promise<void> {
    const selectedNotes = Object.values(this.selectedNotes);
    await this.application.mutator.changeItem(tag.uuid, (mutator) => {
      for (const note of selectedNotes) {
        mutator.removeItemAsRelationship(note);
      }
    });
    this.application.sync.sync();
  }

  isTagInSelectedNotes(tag: SNTag): boolean {
    const selectedNotes = Object.values(this.selectedNotes);
    return selectedNotes.every((note) =>
      this.appState
        .getNoteTags(note)
        .find((noteTag) => noteTag.uuid === tag.uuid)
    );
  }

  setShowProtectedWarning(show: boolean): void {
    this.showProtectedWarning = show;
  }

  async emptyTrash(): Promise<void> {
    if (
      await confirmDialog({
        text: StringEmptyTrash(this.trashedNotesCount),
        confirmButtonStyle: 'danger',
      })
    ) {
      this.application.mutator.emptyTrash();
      this.application.sync.sync();
    }
  }

  private get io() {
    return this.application.io;
  }

  setShowRevisionHistoryModal(show: boolean): void {
    this.showRevisionHistoryModal = show;
  }
}
