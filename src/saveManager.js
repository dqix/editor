import { Buffer } from "buffer"
import crc32 from "crc-32"

import gameData from "./game/data"
import { readStringFromBuffer, writeStringToBuffer } from "./game/string"

export const STATE_NULL = 0
export const STATE_LOADING = 1
export const STATE_LOADED = 2

/// total size of one save slot in bytes
const SAVE_SIZE = 32768

const CHECKSUM_A_OFFSET = 16
const CHECKSUM_A_DATA_OFFSET = 20
const CHECKSUM_A_DATA_END = 36

const CHECKSUM_B_OFFSET = 132
const CHECKSUM_B_DATA_OFFSET = 136
const CHECKSUM_B_DATA_END = 28644

/// total size of a character's data in bytes
const CHARACTER_SIZE = 572

/// offset of name relative to beginning of character data
const CHARACTER_NAME_OFFSET = 456
/// max length of name in bytes
const NAME_LENGTH = 10

/// offset of name equipments relative to beginning of character data
const CHARACTER_EQUIPMENT_OFFSET = 488

/// offset of character gender/colors byte relative to beginning of character data
// u8 laid out like: `eeeesssg`
// where e is eye color, s is skin color, and g is gender
const CHARACTER_GENDER_COLORS_OFFSET = 508

const CHARACTER_FACE_OFFSET = 492
const CHARACTER_HAIRSTYLE_OFFSET = 494
/// offset of character hairstyle byte relative to beginning of character data
// u8 laid out like: `xxxxcccc`
// where x is unknown data, and c is the color index
const CHARACTER_HAIR_COLOR_OFFSET = 509

const CHARACTER_BODY_TYPE_W = 512
const CHARACTER_BODY_TYPE_H = 514

/// offset of current vocation index relative to beginning of character data
const CURRENT_VOCATION_OFFSET = 216

/// offset of character's held items, relative to the beginning of the save
const HELD_ITEM_OFFSET = 7578

/// offset of character's skill allocation array, relative to beginning of character data
const CHARACTER_SKILL_ALLOCATIONS_OFFSET = 383

/// offset of character's proficiency bitflags, relative to beginning of character data
const CHARACTER_PROFICIENCY_OFFSET = 418

/// offset of character's unallocated skill points, relative to beginning of character data
const CHARACTER_UNALLOCATED_SKILL_POINTS_OFFSET = 380

const CHARACTER_ZOOM_OFFSET = 416
const CHARACTER_EGG_ON_OFFSET = 453

/// items are stored in 2 contiguous arrays, one of the ids which are u16s and one of the counts which are u8s
// prettier-ignore
const itemOffsets = {
  [gameData.ITEM_TYPE_COMMON]:    { idOffset: 7664,  countOffset: 7968,  needsPacking: true },
  [gameData.ITEM_TYPE_IMPORTANT]: { idOffset: 11164, countOffset: 11352, needsPacking: true },
  [gameData.ITEM_TYPE_WEAPON]:    { idOffset: 8120,  countOffset: 10136 },
  [gameData.ITEM_TYPE_SHIELD]:    { idOffset: 8664,  countOffset: 10408 },
  [gameData.ITEM_TYPE_TORSO]:     { idOffset: 8760,  countOffset: 10456 },
  [gameData.ITEM_TYPE_HEAD]:      { idOffset: 9336,  countOffset: 10744 },
  [gameData.ITEM_TYPE_ARM]:       { idOffset: 9624,  countOffset: 10888 },
  [gameData.ITEM_TYPE_FEET]:      { idOffset: 9784,  countOffset: 10968 },
  [gameData.ITEM_TYPE_LEGS]:      { idOffset: 9144,  countOffset: 10648 },
  [gameData.ITEM_TYPE_ACCESSORY]: { idOffset: 10008, countOffset: 11080 },
}

const GOLD_ON_HAND_OFFSET = 11448
const GOLD_IN_BANK_OFFSET = 11452

const MINI_MEDAL_OFFSET = 11460

const PARTY_TRICK_LEARNED_OFFSET = 12108

const PLAYTIME_HOURS = 16024
const PLAYTIME_MINUTES = 16026
const PLAYTIME_SECONDS = 16027

const MULTIPLAYER_HOURS = 16028
const MULTIPLAYER_MINUTES = 16030
const MULTIPLAYER_SECONDS = 16031

const UNLOCKABLE_VOCATION_OFFSET = 12276

const VISITED_LOCATIONS_OFFSET = 11788

/// offset of canvased guest array
const CANVASED_GUEST_OFFSET = 16200

/// size of canvased guest structure
const CANVASED_GUEST_SIZE = 232

/// offset of name relative to beginning of guest data
const GUEST_NAME_OFFSET = 0

/// offset of special guest bitflags
const SPECIAL_GUEST_OFFSET = 11528

export default class SaveManager {
  constructor(buffer) {
    this.state = buffer == null ? STATE_NULL : STATE_LOADED
    this.buffer = buffer

    this.saveIdx = 0
    this.saveSlots = []

    if (this.buffer) {
      this.saveSlots = [
        this.buffer.subarray(0, SAVE_SIZE),
        this.buffer.subarray(SAVE_SIZE, SAVE_SIZE + SAVE_SIZE),
      ]

      this.validate()
    }
  }

  validate() {
    if (!this.buffer) {
      return false
    }

    if (this.buffer.length < 65536) {
      return false
    }

    const MAGIC_NUMBER = Buffer.from([
      // `DRAGON QUEST IX` in hex, the save file's magic "number"
      0x44, 0x52, 0x41, 0x47, 0x4f, 0x4e, 0x20, 0x51, 0x55, 0x45, 0x53, 0x54, 0x20, 0x49, 0x58,
    ])

    if (!MAGIC_NUMBER.compare(this.buffer.subarray(0, 0 + MAGIC_NUMBER.length)) == 0) {
      return false
    }

    for (let i = 0; i < 2; i++) {
      //FIXME
      this.getChecksums(i)
      const a = crc32.buf(
        this.saveSlots[i].subarray(CHECKSUM_A_DATA_OFFSET, CHECKSUM_A_DATA_END),
        0
      )
      const b = crc32.buf(
        this.saveSlots[i].subarray(CHECKSUM_B_DATA_OFFSET, CHECKSUM_B_DATA_END),
        0
      )

      // NOTE: crc-32 returns an int instead of a uint
      const srcA = this.saveSlots[i].readInt32LE(CHECKSUM_A_OFFSET)
      const srcB = this.saveSlots[i].readInt32LE(CHECKSUM_B_OFFSET)

      if (a != srcA || b != srcB) {
        return false
      }
    }

    return true
  }

  load(buffer) {
    this.buffer = buffer
  }

  async loadDemo() {
    const response = await fetch("demo.sav")
    if (!response.ok) {
      return null
    }

    return Buffer.from(await response.arrayBuffer())
  }

  download() {
    for (let i = 0; i < 2; i++) {
      let newChecksums = this.makeChecksums(i)
      this.saveSlots[i].writeInt32LE(newChecksums[0], CHECKSUM_A_OFFSET)
      this.saveSlots[i].writeInt32LE(newChecksums[1], CHECKSUM_B_OFFSET)
    }

    const el = document.createElement("a")
    const blob = new Blob([this.buffer], { type: "octet/stream" })
    const url = window.URL.createObjectURL(blob)
    el.href = url
    el.download = "edited.sav"
    el.click()
    window.URL.revokeObjectURL(url)
  }

  /// returns the new checksums for the current save buffer
  makeChecksums(slot) {
    return [
      crc32.buf(this.saveSlots[slot].subarray(CHECKSUM_A_DATA_OFFSET, CHECKSUM_A_DATA_END), 0),
      crc32.buf(this.saveSlots[slot].subarray(CHECKSUM_B_DATA_OFFSET, CHECKSUM_B_DATA_END), 0),
    ]
  }

  /// returns the current checksums in the save buffer
  getChecksums(slot) {
    return [
      this.saveSlots[slot].readInt32LE(CHECKSUM_A_OFFSET),
      this.saveSlots[slot].readInt32LE(CHECKSUM_B_OFFSET),
    ]
  }

  /// returns the party's order
  getPartyOrder() {
    /// order of party members
    const PARTY_ORDER_OFFSET = 7573

    const order = []
    const partyCount = this.getPartyCount()
    for (let i = 0; i < partyCount; i++) {
      order.push(this.saveSlots[this.saveIdx][PARTY_ORDER_OFFSET + i])
    }

    return order
  }

  /// returns the number of characters waiting in the wings
  getStandbyCount() {
    /// number of characters in standby
    const STANDBY_COUNT_OFFSET = 7572

    return this.saveSlots[this.saveIdx][STANDBY_COUNT_OFFSET]
  }

  /// returns the number of characters in the party
  getPartyCount() {
    /// number of characters in party
    const PARTY_COUNT_OFFSET = 7577

    return this.saveSlots[this.saveIdx][PARTY_COUNT_OFFSET]
  }

  /// returns the total number of characters
  getCharacterCount() {
    return this.getStandbyCount() + this.getPartyCount()
  }

  /// returns true if the character index is in the party
  inParty(n) {
    return n >= this.getStandbyCount()
  }

  isHero(n) {
    return n == this.getStandbyCount()
  }

  /// returns the utf8 encoded name, any unknown characters will be returned as ?
  getCharacterName(n) {
    const character_offset = CHARACTER_SIZE * n

    return readStringFromBuffer(
      this.saveSlots[this.saveIdx].subarray(
        character_offset + CHARACTER_NAME_OFFSET,
        character_offset + CHARACTER_NAME_OFFSET + NAME_LENGTH
      )
    )
  }

  /// sets the character name from a utf8 encoded string, any unknown characters will be serialized
  /// as ?, if the name is longer than the maximum name length it will be trimmed
  writeCharacterName(n, name) {
    const character_offset = CHARACTER_SIZE * n

    name = name.substr(0, NAME_LENGTH).padEnd(NAME_LENGTH, "\0")
    console.log(name)

    let b = writeStringToBuffer(name)

    b.copy(this.saveSlots[this.saveIdx], character_offset + CHARACTER_NAME_OFFSET)
  }

  getCharacterGender(n) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx][character_offset + CHARACTER_GENDER_COLORS_OFFSET] & 1
  }

  getCharacterFace(n) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx][character_offset + CHARACTER_FACE_OFFSET]
  }

  setCharacterFace(n, value) {
    const character_offset = CHARACTER_SIZE * n
    this.saveSlots[this.saveIdx][character_offset + CHARACTER_FACE_OFFSET] = value
  }

  getCharacterHairstyle(n) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx][character_offset + CHARACTER_HAIRSTYLE_OFFSET]
  }

  setCharacterHairstyle(n, value) {
    const character_offset = CHARACTER_SIZE * n
    this.saveSlots[this.saveIdx][character_offset + CHARACTER_HAIRSTYLE_OFFSET] = value
  }

  getCharacterEyeColor(n) {
    const character_offset = CHARACTER_SIZE * n

    return (
      (this.saveSlots[this.saveIdx][character_offset + CHARACTER_GENDER_COLORS_OFFSET] & 0xf0) >> 4
    )
  }

  setCharacterEyeColor(n, color) {
    const character_offset = CHARACTER_SIZE * n
    const prev = this.saveSlots[this.saveIdx][character_offset + CHARACTER_GENDER_COLORS_OFFSET]
    return (this.saveSlots[this.saveIdx][character_offset + CHARACTER_GENDER_COLORS_OFFSET] =
      (prev & 0x0f) | (color << 4))
  }

  getCharacterSkinColor(n) {
    const character_offset = CHARACTER_SIZE * n

    return (
      (this.saveSlots[this.saveIdx][character_offset + CHARACTER_GENDER_COLORS_OFFSET] & 0xe) >> 1
    )
  }

  setCharacterSkinColor(n, color) {
    const character_offset = CHARACTER_SIZE * n
    const prev = this.saveSlots[this.saveIdx][character_offset + CHARACTER_GENDER_COLORS_OFFSET]
    return (this.saveSlots[this.saveIdx][character_offset + CHARACTER_GENDER_COLORS_OFFSET] =
      (prev & 0xf1) | (color << 1))
  }

  getCharacterHairColor(n) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx][character_offset + CHARACTER_HAIR_COLOR_OFFSET] & 0xf
  }

  setCharacterHairColor(n, value) {
    const character_offset = CHARACTER_SIZE * n
    const prev = this.saveSlots[this.saveIdx][character_offset + CHARACTER_HAIR_COLOR_OFFSET]
    this.saveSlots[this.saveIdx][character_offset + CHARACTER_HAIR_COLOR_OFFSET] =
      (prev & 0xf0) | (value & 0x0f)
  }

  getCharacterBodyTypeW(n) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx].readUInt16LE(character_offset + CHARACTER_BODY_TYPE_W)
  }

  getCharacterBodyTypeH(n) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx].readUInt16LE(character_offset + CHARACTER_BODY_TYPE_H)
  }

  setCharacterBodyTypeW(n, value) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx].writeUInt16LE(
      value,
      character_offset + CHARACTER_BODY_TYPE_W
    )
  }

  setCharacterBodyTypeH(n, value) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx].writeUInt16LE(
      value,
      character_offset + CHARACTER_BODY_TYPE_H
    )
  }

  getCharacterSkillAllocation(n, skill) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx][
      character_offset + CHARACTER_SKILL_ALLOCATIONS_OFFSET + skill
    ]
  }

  setCharacterSkillAllocationRaw(n, skill, value) {
    const character_offset = CHARACTER_SIZE * n
    this.saveSlots[this.saveIdx][character_offset + CHARACTER_SKILL_ALLOCATIONS_OFFSET + skill] =
      value
  }

  setCharacterSkillAllocation(n, skill, value) {
    value = Math.max(0, Math.min(100, value))
    this.setCharacterSkillAllocationRaw(n, skill, value)

    for (const p of gameData.skills[skill].proficiencies) {
      this.setCharacterProficiency(n, p.id, p.points <= value)
    }
  }

  getCharacterProficiency(n, id) {
    const character_offset = CHARACTER_SIZE * n
    return !!(
      this.saveSlots[this.saveIdx][
        character_offset + CHARACTER_PROFICIENCY_OFFSET + Math.floor(id / 8)
      ] &
      (1 << id % 8)
    )
  }

  setCharacterProficiency(n, id, value) {
    const character_offset = CHARACTER_SIZE * n
    const mask = 1 << id % 8

    this.saveSlots[this.saveIdx][
      character_offset + CHARACTER_PROFICIENCY_OFFSET + Math.floor(id / 8)
    ] =
      (this.saveSlots[this.saveIdx][
        character_offset + CHARACTER_PROFICIENCY_OFFSET + Math.floor(id / 8)
      ] &
        ~mask) |
      (value ? mask : 0)
  }

  knowsZoom(n) {
    const character_offset = CHARACTER_SIZE * n

    return !!(this.saveSlots[this.saveIdx][character_offset + CHARACTER_ZOOM_OFFSET] & 0x10)
  }

  knowsEggOn(n) {
    const character_offset = CHARACTER_SIZE * n

    return !!(this.saveSlots[this.saveIdx][character_offset + CHARACTER_EGG_ON_OFFSET] & 0x40)
  }

  setKnowsZoom(n, knows) {
    const character_offset = CHARACTER_SIZE * n

    knows = knows ? 0x10 : 0
    const prev = this.saveSlots[this.saveIdx][character_offset + CHARACTER_ZOOM_OFFSET] & 0x10
    this.saveSlots[this.saveIdx][character_offset + CHARACTER_ZOOM_OFFSET] = (prev & 0xef) | knows
  }

  setKnowsEggOn(n, knows) {
    const character_offset = CHARACTER_SIZE * n

    knows = knows ? 0x40 : 0
    const prev = this.saveSlots[this.saveIdx][character_offset + CHARACTER_EGG_ON_OFFSET] & 0x40
    this.saveSlots[this.saveIdx][character_offset + CHARACTER_EGG_ON_OFFSET] = (prev & 0xbf) | knows
  }

  getUnallocatedSkillPoints(n) {
    const character_offset = CHARACTER_SIZE * n

    return this.saveSlots[this.saveIdx].readUInt16LE(
      character_offset + CHARACTER_UNALLOCATED_SKILL_POINTS_OFFSET
    )
  }

  setUnallocatedSkillPoints(n, pts) {
    const character_offset = CHARACTER_SIZE * n

    pts = Math.max(0, Math.min(9999, pts))

    this.saveSlots[this.saveIdx].writeUInt16LE(
      pts,
      character_offset + CHARACTER_UNALLOCATED_SKILL_POINTS_OFFSET
    )
  }

  /// returns the item id for the equipped item in the given slot, n is the character index
  /// type is the item type, `ITEM_TYPE_COMMON` and `ITEM_TYPE_IMPORTANT` are not valid
  getCharacterEquipment(n, type) {
    if (type <= 0 || type > gameData.ITEM_TYPE_ACCESSORY) {
      return null
    }

    const character_offset = CHARACTER_SIZE * n

    return this.saveSlots[this.saveIdx].readUInt16LE(
      character_offset + CHARACTER_EQUIPMENT_OFFSET + (type - 1) * 2
    )
  }

  /// Sets the equipped item in the given slot for the given character
  setCharacterEquipment(n, type, id) {
    if (type <= 0 || type > gameData.ITEM_TYPE_ACCESSORY) {
      return null
    }

    const character_offset = CHARACTER_SIZE * n

    return this.saveSlots[this.saveIdx].writeUInt16LE(
      id,
      character_offset + CHARACTER_EQUIPMENT_OFFSET + (type - 1) * 2
    )
  }

  /// returns the vocation index of the given character
  getCharacterVocation(n) {
    const character_offset = CHARACTER_SIZE * n
    return this.saveSlots[this.saveIdx][character_offset + CURRENT_VOCATION_OFFSET]
  }

  /// returns the ith item held by the nth character, assumes the character is in the party
  getHeldItem(n, i) {
    n -= this.getStandbyCount()
    if (!(0 <= n && n < 4) || !(0 <= i && i < 8)) {
      return []
    }

    return this.saveSlots[this.saveIdx].readUInt16LE(HELD_ITEM_OFFSET + 18 * n + 2 * i)
  }

  /// sets the ith item held by the nth character, assumes the character is in the party
  setHeldItem(n, i, id) {
    n -= this.getStandbyCount()
    if (!(0 <= n && n < 4) || !(0 <= i && i < 8)) {
      return
    }

    return this.saveSlots[this.saveIdx].writeUInt16LE(id, HELD_ITEM_OFFSET + 18 * n + 2 * i)
  }

  /// returns the number of an item in the bag
  /// NOTE: this can be expensive
  getItemCount(id) {
    const itemType = gameData.items[id].item_type
    const offset = itemOffsets[itemType]

    let idx = 0xffff
    //NOTE: linear search isn't ideal here, maybe make this a hashmap created in the constructor?
    for (let i = 0; i < gameData.itemTables[itemType].length; i++) {
      if (this.saveSlots[this.saveIdx].readUInt16LE(offset.idOffset + 2 * i) == id) {
        idx = i
        break
      }
    }

    return idx != 0xffff ? this.saveSlots[this.saveIdx][offset.countOffset + idx] : 0
  }

  /// sets the number of an item in the bag
  /// NOTE: this can be expensive
  setItemCount(id, count) {
    const itemType = gameData.items[id].item_type

    const offset = itemOffsets[gameData.items[id].item_type]
    let idx = 0xffff

    let available = null
    for (let i = 0; i < gameData.itemTables[itemType].length; i++) {
      if (this.saveSlots[this.saveIdx].readUInt16LE(offset.idOffset + 2 * i) == id) {
        idx = i
        break
      }
      if (
        available === null &&
        this.saveSlots[this.saveIdx].readUInt16LE(offset.idOffset + 2 * i) == 0xffff
      ) {
        available = i
      }
    }

    if (idx == 0xffff) idx = available

    this.saveSlots[this.saveIdx][offset.countOffset + idx] = count
    if (count == 0) {
      this.saveSlots[this.saveIdx].writeUInt16LE(0xffff, offset.idOffset + 2 * idx)
    } else {
      this.saveSlots[this.saveIdx].writeUInt16LE(id, offset.idOffset + 2 * idx)
    }

    if (offset.needsPacking) {
      this.packItems(itemType)
    }
  }

  /// everyday and important items need to be packed densely for the game's ui to work well,
  /// this is not the case with equipment
  packItems(type) {
    const offset = itemOffsets[type]
    outer: for (let i = 0; i < gameData.itemTables[type].length; i++) {
      if (this.saveSlots[this.saveIdx].readUInt16LE(offset.idOffset + 2 * i) == 0xffff) {
        for (let j = i + 1; j < gameData.itemTables[type].length; j++) {
          if (this.saveSlots[this.saveIdx].readUInt16LE(offset.idOffset + 2 * j) != 0xffff) {
            this.saveSlots[this.saveIdx].writeUInt16LE(
              this.saveSlots[this.saveIdx].readUInt16LE(offset.idOffset + 2 * j),
              offset.idOffset + 2 * i
            )
            this.saveSlots[this.saveIdx][offset.countOffset + i] =
              this.saveSlots[this.saveIdx][offset.countOffset + j]

            this.saveSlots[this.saveIdx][offset.countOffset + j] = 0
            this.saveSlots[this.saveIdx].writeUInt16LE(0xffff, offset.idOffset + 2 * j)

            continue outer
          }
        }

        break
      }
    }
  }

  getGoldOnHand() {
    return this.saveSlots[this.saveIdx].readUInt32LE(GOLD_ON_HAND_OFFSET)
  }

  getGoldInBank() {
    return this.saveSlots[this.saveIdx].readUInt32LE(GOLD_IN_BANK_OFFSET)
  }

  setGoldOnHand(gold) {
    gold = Math.max(0, Math.min(gold, 9999999))
    return this.saveSlots[this.saveIdx].writeUInt32LE(gold, GOLD_ON_HAND_OFFSET)
  }

  setGoldInBank(gold) {
    gold = Math.max(0, Math.min(gold, 1000000000))
    return this.saveSlots[this.saveIdx].writeUInt32LE(gold, GOLD_IN_BANK_OFFSET)
  }

  getMiniMedals() {
    return this.saveSlots[this.saveIdx].readUint32LE(MINI_MEDAL_OFFSET)
  }

  setMiniMedals(medals) {
    this.saveSlots[this.saveIdx].writeUint32LE(medals, MINI_MEDAL_OFFSET)
  }

  getPartyTrickLearned(i) {
    if (!(0 <= i && i <= 14)) {
      return null
    }

    return this.saveSlots[this.saveIdx].readInt32LE(PARTY_TRICK_LEARNED_OFFSET) & (1 << (i + 2))
  }

  setPartyTrickLearned(i, learned) {
    if (!(0 <= i && i <= 14)) {
      return
    }
    learned = learned ? 1 : 0
    i += 2

    let prev = this.saveSlots[this.saveIdx].readInt32LE(PARTY_TRICK_LEARNED_OFFSET)

    this.saveSlots[this.saveIdx].writeInt32LE(
      (prev & ~(1 << i)) | (learned << i),
      PARTY_TRICK_LEARNED_OFFSET
    )
  }

  getPlaytime() {
    return [
      this.saveSlots[this.saveIdx].readUint16LE(PLAYTIME_HOURS),
      this.saveSlots[this.saveIdx][PLAYTIME_MINUTES],
      this.saveSlots[this.saveIdx][PLAYTIME_SECONDS],
    ]
  }

  getMultiplayerTime() {
    return [
      this.saveSlots[this.saveIdx].readUint16LE(MULTIPLAYER_HOURS),
      this.saveSlots[this.saveIdx][MULTIPLAYER_MINUTES],
      this.saveSlots[this.saveIdx][MULTIPLAYER_SECONDS],
    ]
  }

  setPlaytime(value) {
    value[0] = Math.max(0, Math.min(0xffff, value[0]))
    value[1] = Math.max(0, Math.min(59, value[1]))
    value[2] = Math.max(0, Math.min(59, value[2]))
    this.saveSlots[this.saveIdx].writeUint16LE(value[0], PLAYTIME_HOURS)
    this.saveSlots[this.saveIdx][PLAYTIME_MINUTES] = value[1]
    this.saveSlots[this.saveIdx][PLAYTIME_SECONDS] = value[2]
  }

  setMultiplayerTime(value) {
    value[0] = Math.max(0, Math.min(0xffff, value[0]))
    value[1] = Math.max(0, Math.min(59, value[1]))
    value[2] = Math.max(0, Math.min(59, value[2]))
    this.saveSlots[this.saveIdx].writeUint16LE(value[0], MULTIPLAYER_HOURS)
    this.saveSlots[this.saveIdx][MULTIPLAYER_MINUTES] = value[1]
    this.saveSlots[this.saveIdx][MULTIPLAYER_SECONDS] = value[2]
  }

  /// Returns true if the vocation is unlocked, id is the index into `gameData.vocationTable`
  isVocationUnlocked(id) {
    return !!(
      this.saveSlots[this.saveIdx].readUint16LE(UNLOCKABLE_VOCATION_OFFSET) &
      (1 << (id - 1))
    )
  }

  setVocationUnlocked(id, unlocked) {
    id -= 1
    unlocked = unlocked ? 1 : 0

    const prev = this.saveSlots[this.saveIdx].readUint16LE(UNLOCKABLE_VOCATION_OFFSET)
    this.saveSlots[this.saveIdx].writeUint16LE(
      (prev & ~(1 << id)) | (unlocked << id),
      UNLOCKABLE_VOCATION_OFFSET
    )
  }

  visitedLocation(i) {
    return this.saveSlots[this.saveIdx].readInt32LE(VISITED_LOCATIONS_OFFSET) & (1 << i)
  }

  setVisitedLocation(i, visited) {
    visited = visited ? 1 : 0

    const prev = this.saveSlots[this.saveIdx].readInt32LE(VISITED_LOCATIONS_OFFSET)
    this.saveSlots[this.saveIdx].writeInt32LE(
      (prev & ~(1 << i)) | (visited << i),
      VISITED_LOCATIONS_OFFSET
    )
  }

  // getCanvasedGuestCount() {}

  getCanvasedGuestName(n) {
    const offset = CANVASED_GUEST_OFFSET + n * CANVASED_GUEST_SIZE

    return readStringFromBuffer(
      this.saveSlots[this.saveIdx].subarray(
        offset + GUEST_NAME_OFFSET,
        offset + GUEST_NAME_OFFSET + NAME_LENGTH
      )
    )
  }

  isSpecialGuestVisiting(i) {
    return !!(this.saveSlots[this.saveIdx].readInt32LE(SPECIAL_GUEST_OFFSET) & (1 << (i + 1)))
  }

  setSpecialGuestVisiting(i, visiting) {
    const prev = this.saveSlots[this.saveIdx].readInt32LE(SPECIAL_GUEST_OFFSET)
    const mask = 1 << (i + 1)
    this.saveSlots[this.saveIdx].writeInt32LE(
      (prev & ~mask) | (visiting ? mask : 0),
      SPECIAL_GUEST_OFFSET
    )
  }
}
