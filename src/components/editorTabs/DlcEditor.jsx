import { useContext, useState } from "react"

import "./DlcEditor.scss"

import gameData from "../../game/data"
import Card from "../atoms/Card"
import ItemSelect from "../atoms/ItemSelect"
import Input from "../atoms/Input"
import SaveManager from "../../saveManager"
import { SaveManagerContext } from "../../SaveManagerContext"

export default props => {
  const { save, setSave } = useContext(SaveManagerContext)
  const [listing, setListing] = useState(gameData.dqvcListings.length)

  return (
    <div className="dlc-root">
      <Card label="special guests:" className="special-guests">
        <div>
          {gameData.specialGuests.map((name, i) => (
            <label key={i}>
              <Input
                type="checkbox"
                checked={save.isSpecialGuestVisiting(i)}
                onChange={e => {
                  save.setSpecialGuestVisiting(i, e.target.checked)
                  setSave(new SaveManager(save.buffer))
                }}
              />
              {name}
            </label>
          ))}
        </div>
      </Card>
      <Card label="dqvc:" className="dqvc">
        <table>
          <thead>
            <tr>
              <th style={{ width: "60%" }}>
                <small>item</small>
              </th>
              <th style={{ width: "20%" }}>
                <small>price</small>
              </th>
              <th style={{ width: "100%" }}>
                <small>stock</small>
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, i) => {
              return (
                <tr key={i}>
                  <td>
                    <ItemSelect
                      items={gameData.itemTables}
                      nothingName={"---"}
                      nothingValue={0xffff}
                      id={save.getDqvcItem(i)}
                      onChange={e => {
                        save.setDqvcItem(i, e.target.value)
                        setSave(new SaveManager(save.buffer))
                      }}
                    />
                  </td>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      max={33554431}
                      size={10}
                      value={save.getDqvcPrice(i)}
                      onChange={e => {
                        save.setDqvcPrice(i, e.target.value)
                        setSave(new SaveManager(save.buffer))
                      }}
                    />
                    g
                  </td>
                  <td>
                    <Input
                      type="number"
                      min={0}
                      max={127}
                      size={4}
                      value={save.getDqvcStock(i)}
                      onChange={e => {
                        save.setDqvcStock(i, e.target.value)
                        setSave(new SaveManager(save.buffer))
                      }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p>
          <small>past listings:</small>
        </p>
        <select
          value={listing}
          onChange={e => {
            setListing(e.target.value)
          }}
        >
          <option value={gameData.dqvcListings.length}>---</option>
          {gameData.dqvcListings.map((listing, i) => (
            <option key={i} value={i}>
              {listing.name}
            </option>
          ))}
        </select>
        {gameData.dqvcListings[listing] && (
          <>
            <button>⚄</button>
            <a href={gameData.dqvcListings[listing].link} target="_blank">
              yab's list
            </a>
          </>
        )}
      </Card>

      {/* TODO: */}
      {/* <Card label="unlock:" className="unlock">
        // - unlock dlc all quests
        // - set all special guests to be visiting
        <button>unlock all</button>
        // - give all dlc exclusive items?
        <button>unlock all with items</button>
      </Card> */}
    </div>
  )
}