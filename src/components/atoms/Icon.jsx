import itemIcons from "../../assets/itemIcons.png"
import vocationIcons from "../../assets/vocationIcons.png"
import appearanceIcons from "../../assets/appearanceIcons-transparent.png"
import questStatusIcons from "../../assets/questStatusIcons.png"
import genderIcons from "../../assets/genderIcons.png"
import grottoStateIcons from "../../assets/grottoStateIcons.png"

export const ItemIcon = props => (
  <div
    style={{
      width: "24px",
      height: "24px",
      display: "inline-block",
      verticalAlign: "top",
      backgroundImage: `url(${itemIcons})`,
      backgroundPosition: `-${1 + 25 * (props.icon % 11)}px -${
        1 + 25 * Math.floor(props.icon / 11)
      }px`,
      ...props.style,
    }}
    className="icon item-icon"
  ></div>
)

export const VocationIcon = props => (
  <div
    style={{
      width: "24px",
      height: "24px",
      display: "inline-block",
      verticalAlign: "top",
      backgroundImage: `url(${vocationIcons})`,
      backgroundPosition: `0px -${props.icon * 24}px`,
      ...props.style,
    }}
    className="icon"
  ></div>
)

export const AppearanceIcon = props => {
  const scale = props.scale || 1
  const size = 64 * scale
  const kind = props.kind + props.gender
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "inline-block",
        verticalAlign: "top",
        backgroundImage: `url(${appearanceIcons})`,
        backgroundPosition: `-${kind * size}px -${props.icon * size}px`,
        backgroundSize: `${256 * scale}px ${640 * scale}px`,
        ...props.style,
      }}
    ></div>
  )
}

export const QuestStatusIcon = props => {
  const scale = 0.75

  return (
    <div
      style={{
        width: scale * 22 + "px",
        height: scale * 22 + "px",
        display: "inline-block",
        verticalAlign: "top",
        backgroundImage: `url(${questStatusIcons})`,
        backgroundPosition: `-0px -${22 * scale * Math.floor(props.icon)}px`,
        backgroundSize: `${22 * scale}px ${88 * scale}px`,
        ...props.style,
      }}
    ></div>
  )
}

export const GenderIcon = props => {
  const scale = 1

  return (
    <div
      {...props}
      style={{
        width: scale * 28 + "px",
        height: scale * 28 + "px",
        display: "inline-block",
        verticalAlign: "top",
        backgroundImage: `url(${genderIcons})`,
        backgroundPosition: `-0px -${28 * scale * Math.floor(props.icon)}px`,
        backgroundSize: `${28 * scale}px ${56 * scale}px`,
        ...props.style,
      }}
    ></div>
  )
}

export const GrottoStateIcon = props => {
  const scale = 0.8

  return (
    <div
      className="icon"
      style={{
        width: scale * 22 + "px",
        height: scale * 22 + "px",
        display: "inline-block",
        verticalAlign: "top",
        backgroundImage: `url(${grottoStateIcons})`,
        backgroundPosition: `-0px -${22 * scale * props.icon}px`,
        backgroundSize: `${22 * scale}px ${88 * scale}px`,
        ...props.style,
      }}
    ></div>
  )
}
