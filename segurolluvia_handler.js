/**
 * Copyright 2016 Intel Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ------------------------------------------------------------------------------
 */

const { TransactionHandler } = require('sawtooth-sdk/processor/handler')
const { InvalidTransaction, InternalError } = require('sawtooth-sdk/processor/exceptions')
const cbor = require('cbor')

/* State */

const crypto = require('crypto')

const _hash = (x) =>
  crypto.createHash('sha512').update(x).digest('hex').toLowerCase()

// Constants defined in segurolluvia specification
const MIN_VALUE = 0
const MAX_VALUE = 4294967295
const MAX_NAME_LENGTH = 20
const MAX_BANK_ACCOUNT_LENGTH = 16
const TP_FAMILY = 'segurolluvia'
const TP_NAMESPACE = _hash(TP_FAMILY).substring(0, 6)
const TP_VERSION = '1.0.0'

const _decodeCbor = (buffer) =>
  new Promise((resolve, reject) =>
    cbor.decodeFirst(buffer, (err, obj) => (err ? reject(err) : resolve(obj)))
  )

const _toInternalError = (err) => {
  let message = (err.message) ? err.message : err
  throw new InternalError(message)
}

const _setEntry = (context, address, stateValue) => {
  let entries = {
    [address]: cbor.encode(stateValue)
  }
  return context.setState(entries)
}

const _applySet = (context, address, name, mail, bankAccount, 
						placeAddress, town, province, checkinDate, checkoutDate,
						days, rainAmount, startHour, endHour, refund, 
						purchase, total) => (possibleAddressValues) => {
  let stateValueRep = possibleAddressValues[address]

  let stateValue
  if (stateValueRep && stateValueRep.length > 0) {
    stateValue = cbor.decodeFirstSync(stateValueRep)
    let stateName = stateValue[purchase]
    if (stateName) {
      throw new InvalidTransaction(
        `Verb is "buy" but Purchase ${purchase} already in state`
      )
    }
  }

  // 'set' passes checks so store it in the state
  if (!stateValue) {
    stateValue = {}
  }

  //stateValue[name] = value
  stateValue[purchase] = {name, mail, bankAccount, placeAddress, town, province, checkinDate, 
							checkoutDate, days, rainAmount, startHour, endHour, refund, total}

  return _setEntry(context, address, stateValue)
}

const _applyOperator = (verb, op) => (context, address, name, value) => (possibleAddressValues) => {
  let stateValueRep = possibleAddressValues[address]
  if (!stateValueRep || stateValueRep.length === 0) {
    throw new InvalidTransaction(`Verb is "${verb}" but Name is not in state`)
  }

  let stateValue = cbor.decodeFirstSync(stateValueRep)
  if (stateValue[name] === null || stateValue[name] === undefined) {
    throw new InvalidTransaction(`Verb is "${verb}" but Name is not in state`)
  }

  const result = op(stateValue[name], value)

  if (result < MIN_VALUE) {
    throw new InvalidTransaction(
      `Verb is "${verb}", but result would be less than ${MIN_VALUE}`
    )
  }

  if (result > MAX_VALUE) {
    throw new InvalidTransaction(
      `Verb is "${verb}", but result would be greater than ${MAX_VALUE}`
    )
  }

  // Increment the value in state by value
  // stateValue[name] = op(stateValue[name], value)
  stateValue[name] = result
  return _setEntry(context, address, stateValue)
}

const _applyInc = _applyOperator('inc', (x, y) => x + y)
const _applyDec = _applyOperator('dec', (x, y) => x - y)


/* Handler */

class SeguroLluviaHandler extends TransactionHandler {
  constructor() {
    super(TP_FAMILY, [TP_VERSION], [TP_NAMESPACE])
  }

  apply(transactionProcessRequest, context) {
    return _decodeCbor(transactionProcessRequest.payload)
      .catch(_toInternalError)
      .then((update) => {
		  
		// Payload
		//	verb - Accion a realizar (contratar, calcular, getData)
		//	name - Nombre y apellidos del cliente
		//	mail - Email del cliente
		//	bankAccount - numero de cuenta del cliente
		//	placeAddress - direccion de la vivienda alquilada
		//	town - poblacion donde se encuentra la vivienda alquilada
		//	province - provincia donde se encuentra la vivienda alquilada
		//	checkinDate - dia de entrada a la vivienda alquilada
		//	checkoutDate - dia de salida a la vivienda alquilada
		//	days - numero de dias contratados en la poliza
		//	rainAmount - cantidad de lluvia caida
		//	startHour - hora de inicio para calcular la lluvia caida
		//	endHour - hora de fin para calcular la lluvia caida
		//	refund - dinero a devolver si se cumples las condiciones de la poliza
		//	purchase - numero de compra (ID unico)
		//	total - precio total de la compra (vivienda + poliza)
		
		  
        //
        // Validate the update
		// Verb
		let verb = update.Verb
        if (!verb) {
          throw new InvalidTransaction('Verb is required')
        }
		
		// Name
        let name = update.Name
        if (!name) {
          throw new InvalidTransaction('Name is required')
        }
        if (name.length > MAX_NAME_LENGTH) {
          throw new InvalidTransaction(
            `Name must be a string of no more than ${MAX_NAME_LENGTH} characters`
          )
        }
		
		// Mail
		let mail = update.Mail
        if (!mail) {
          throw new InvalidTransaction('Mail is required')
        }
		if (mail.indexOf('@') > -1){
		  throw new InvalidTransaction(
            `Mail must contain @ character`
          )
		}
		
		// BankAccount
        let bankAccount = update.BankAccount
		if (bankAccount === null || bankAccount === undefined) {
          throw new InvalidTransaction('Bank account is required')
        }
		let parsed = parseInt(bankAccount)
        if (parsed !== bankAccount || parsed.length != MAX_BANK_ACCOUNT_LENGTH) {
          throw new InvalidTransaction(
            `Bank Account must be an integer of ${MAX_NAME_LENGTH} numbers`
          )
        }
        bankAccount = parsed
		
		// PlaceAddress
		let placeAddress = update.PlaceAddress
        if (!placeAddress) {
          throw new InvalidTransaction('Place address is required')
        }
		
		// Town
		let town = update.Town
        if (!town) {
          throw new InvalidTransaction('Town is required')
        }
		
		// Province
		let province = update.Province
        if (!province) {
          throw new InvalidTransaction('Province is required')
        }	
		
		// CheckinDate
		let checkinDate = update.CheckinDate
        if (!checkinDate) {
          throw new InvalidTransaction('Checkin date is required')
        }
		
		// CheckoutDate
		let checkoutDate = update.CheckoutDate
        if (!checkoutDate) {
          throw new InvalidTransaction('Checkout date is required')
        }
		
		// Days
		let days = update.Days
		if (days === null || days === undefined) {
          throw new InvalidTransaction('Days is required')
        }
		let parsed = parseInt(days)
		// Comprobar con meteriologia ??????
        days = parsed
		
		// RainAmount (debil, fuerte, muy fuerte, torrencial)
		let rainAmount = update.RainAmount
        if (!rainAmount) {
          throw new InvalidTransaction('Rain amount is required')
        }
		
		// StartHour
		let startHour = update.StartHour
        if (!startHour) {
          throw new InvalidTransaction('Start hour date is required')
        }
		
		// EndHour
		let endHour = update.EndHour
        if (!endHour) {
          throw new InvalidTransaction('End hour date is required')
        }
		
		// Refund
		let refund = update.Refund
		if (refund === null || refund === undefined) {
          throw new InvalidTransaction('Refund is required')
        }
		
		// Purchase
		let purchase = update.Purchase
		if (purchase === null || purchase === undefined) {
          throw new InvalidTransaction('Purchase number is required')
        }
		
		// Total
		let total = update.Total
		if (total === null || total === undefined) {
          throw new InvalidTransaction('Total price is required')
        }
		
				
        // Determine the action to apply based on the verb
        let actionFn
        if (verb === 'buy') {
          actionFn = _applySet
        } else if (verb === 'calculate') {
          actionFn = _applyDec
        } else if (verb === 'getData') {
          actionFn = _applyInc
        } else {
          throw new InvalidTransaction(`Didn't recognize Verb "${verb}".\nMust be "buy", "calculate", or "getData"`)
        }

        let address = TP_NAMESPACE + _hash(purchase).slice(-64)

        // Get the current state, for the key's address:
        let getPromise = context.getState([address])

        // Apply the action to the promise's result:
        let actionPromise = getPromise.then(
          actionFn(context, address, name, mail, bankAccount, 
						placeAddress, town, province, checkinDate, checkoutDate,
						days, rainAmount, startHour, endHour, refund, 
						purchase, total)
        )

        // Validate that the action promise results in the correctly set address:
        return actionPromise.then(addresses => {
          if (addresses.length === 0) {
            throw new InternalError('State error!')
          }
		  console.log(`Verb: ${verb}\nName: ${name}\nMail: ${mail}\nMail: ${mail}\nBankAccount: ${bankAccount}\n` +
            `PlaceAddress: ${placeAddress}\nTown: ${town}\nProvince: ${province}\nCheckinDate: ${checkinDate}\nCheckoutDate: ${checkoutDate}\n` +
            `Days: ${days}\nRainAmount: ${rainAmount}\nStartHour: ${startHour}\nEndHour: ${endHour}\nRefund: ${refund}\n` +
            `purchase: ${purchase}\nTotal: ${total}\n` +
            `----------------------\n`)
        })
      })
  }
}

module.exports = SeguroLluviaHandler
