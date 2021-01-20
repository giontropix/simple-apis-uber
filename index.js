console.log("Server started");
const express = require("express");
const cars = require("./cars.js");
const bodyParser = require("body-parser");
const app = express();
const { body, param, validationResult, query } = require('express-validator');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.listen(3000);

const bookingList = [];

const tokenList = ["pippo1", "pippo2", "pippo3"];

const matchCar = (carId) => cars.find(({ id, available }) => id === carId && available === true);

const findIndexCar = (carId) => cars.findIndex(({ id }) => id === carId);

const getNearestCars = (latitude, longitude) =>
  cars.filter(
    ({ coords, available }) =>
      (coords.lat - latitude < 3 && coords.lat - latitude > -3) ||
      (coords.long - longitude < 3 &&
        coords.long - longitude > -3 &&
        available === true)
  );

const getDistance = (userLat, userLong, destLat, destLong) => Math.abs(userLat - destLat + (userLong - destLong));

const setRanking = (index) => cars[index].votes.map(({ vote }) => vote).reduce((accumulator, current) => accumulator + current) / cars[index].votes.length;

const handeErrors = (req, res, next) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json(errors);
  else next();
}

const checkToken = ({query: {token}}, res, next) => {
  if(!tokenList.find(item => item === token)) return res.status(401).json({errors: "Invalide token"})
  else next();
}

//applichiamo il metodo di express-validator per verificare che il token esista sempre, e il middleware per verificarne la correttezza
app.all("/", query("token").exists(), checkToken)

//liste auto a seconda della query
app.get("/cars", ({ query: {availability} }, res) => {
  if(availability) {
    if (availability === "true") {
      return res.status(200).json(cars.filter(({ available }) => available === true));
    } else if (availability === "false") {
      return res.status(200).json(cars.filter(({ available }) => available === false));
    } else return res.status(400).json({ error: "wrong filter value" });
  } else return res.status(200).json({cars});
});

//auto per id
app.get("/cars/:id", ({ params: { id } }, res) => {
  const car = cars.find(({ id: carId }) => carId === id);
  if (car) return res.status(200).json(car);
  res.status(404).json({ message: "Car not found" });
});

//trova l'auto più vicina
app.get("/cars/nearests/:latitude/:longitude", param("latitude").isNumeric(), param("longitude").isNumeric(), handeErrors, ({ params: { latitude, longitude } }, res) => {
  if (getNearestCars(latitude, longitude) !== []) {
    return res.status(200).json(getNearestCars(latitude, longitude));
  } else return res.status(404).json({ error: "No cars near your position" });
});

//calcolare prezzo del percorso
app.get("/prices/:userLatitude/:userLongitude/:destinationLatitude/:destinationLongitude",
  param("userLatitude").isNumeric(), param("userLongitude").isNumeric(),
  param("destinationLatitude").isNumeric(), param("destinationLongitude").isNumeric(), handeErrors,
  ({ params: { userLatitude, userLongitude, destinationLatitude, destinationLongitude } }, res) => {
    const price = 2;
    const distance = getDistance(userLatitude, userLongitude, destinationLatitude, destinationLongitude) * price;
    res.status(200).json({ message: `Travel estimate is ${distance}€` });
  }
);

//prenotare un'auto
app.post("/reservations/", body("car_id").exists(), body("user").exists(), body("destination").exists(), handeErrors, ({ body: { car_id, user, destination } }, res) => {
  if (matchCar(car_id)) {
    const reservationCode = Date.now();
    bookingList.push({ reservationCode, car_id, user, destination });
    cars[findIndexCar(car_id)].available = false;
    res.status(201).json({ message: `Car ${car_id} reserved with reservation id ${reservationCode}`, debug: { reservation_list: bookingList, car_reserved: cars[findIndexCar(car_id)] }});
  } else res.status(404).json({ error: `Car ${car_id} not found` });
});

//eliminare la prenotazione
app.delete("/reservations/:resId", param("resId").isNumeric(), handeErrors, ({ params: { resId } }, res) => {
    const reservationIndex = bookingList.findIndex(({ reservationCode }) => reservationCode === Number(resId));
    if (reservationIndex >= 0) {
      const removed = bookingList[reservationIndex];
      cars[findIndexCar(removed.car_id)].available = true;
      bookingList.splice(reservationIndex, 1);
      res.status(201).json({
        message: `Reservation for the car ${removed.car_id} with code ${resId} was deleted`,
        debug: { removed, reservation_list: bookingList, car_reserved: cars[findIndexCar(removed.car_id)] },
      });
    } else res.status(404).json({ error: "Reservation not found" });
});

//giudicare una corsa
app.post("/cars/votes/", body("car_id").exists(), body("userName").exists(), body("vote").exists(), handeErrors, ({ body: { car_id, userName, vote } }, res) => {
  const index = findIndexCar(car_id);
  if (index >= 0 && !isNaN(vote)) {
    cars[index].votes.push({ userName: userName, date: new Date().toISOString().slice(0, 10), vote: vote});
    cars[index].ranking = setRanking(index);
    return res.status(201).json({ message: `Driver with code ${car_id} was successfully voted with ${vote}`, details: cars[index]});
  } else return res.status(404).json({ error: `Driver with code ${car_id} not found` });
});

exports.app = app;
exports.bookingList = bookingList;
exports.tokenList = tokenList;
