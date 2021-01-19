require("chai").should();
const request = require("supertest");
const cars = require("../cars.js");
const { app, bookingList, tokenList } = require("../index");
const index = 0;

describe("Uber", () => {
  describe("Show Cars", () => {
    it("Show all cars", async () => {
      const { status, body } = await request(app)
        .get(`/cars?token=${tokenList[index]}`)
        .set("Accept", "application/json");
      status.should.equal(200);
      body.should.have.length === cars.length;
    });
    it("Show available cars", async () => {
      const { status, body } = await request(app).get(`/cars?availability=true&token=${tokenList[index]}`).set("Accept", "application/json");
      status.should.equal(200);
      const allAvailable = body.every((car) => car.available === true);
      allAvailable.should.be.equal(true);
    });
    it("Show unavailable cars", async () => {
      const { status, body } = await request(app)
        .get(`/cars?availability=false&token=${tokenList[index]}`)
        .set("Accept", "application/json");
      status.should.equal(200);
      const allUnavailable = body.every((car) => car.available === false);
      allUnavailable.should.be.equal(true);
    });
    it("Show a single car by id", async () => {
      const { status, body: carFound } = await request(app)
        .get(`/cars/${cars[0].id}?token=${tokenList[index]}`)
        .set("Accept", "application/json");
      status.should.equal(200);
      carFound.should.have.property("model", cars[0].model);
    });
  });

  describe("Show nearest cars", () => {
    it("Show nearest cars successfully", async () => {
      const { status, body } = await request(app).get(`/cars/nearests/2/2?token=${tokenList[index]}`).set("Accept", "application/json");
      status.should.equal(200);
      body.should.have.property("length") > 0;
    });
    describe("Show unsuccessfully", () => {
      it("Show nearest car with wrong latitude", async () => {
        const { status, body } = await request(app)
          .get(`/cars/nearests/wrong/2?token=${tokenList[index]}`)
          .set("Accept", "application/json");
        status.should.equal(400);
        body.should.have.property("errors");
      });
      it("Show nearest car with wrong longitude", async () => {
        const { status, body } = await request(app)
          .get(`/cars/nearests/2/wrong?token=${tokenList[index]}`)
          .set("Accept", "application/json");
        status.should.equal(400);
        body.should.have.property("errors");
      });
    });
  });
  describe("Reservation", () => {
    const carReservation = {
      reservationCode: "123456",
      car_id: "ECHO-01",
      user: "Phil Spencer",
      destination: "Unknow",
    };
    const simulateReservation = () => {
      bookingList.push(carReservation);
      cars[0].available = false;
    };
    it("Reserve a car successfully", async () => {
      const { status, body } = await request(app)
        .post(`/reservations/?token=${tokenList[index]}`)
        .set("Accept", "application/json")
        .send({
          car_id: "ECHO-01",
          user: "Giovanni Tropea",
          destination: "Milan",
        });
      status.should.equal(201);
      cars[0].available.should.be.false;
      body.should.have.property("message");
    });
    describe("Reserve unsuccessfully", () => {
      it("Reserve a car unsuccessfully because of wrong car_id", async () => {
        const { status, body } = await request(app)
          .post(`/reservations/?token=${tokenList[index]}`)
          .set("Accept", "application/json")
          .send({
            car_id: "ECHO-011",
            user: "Giovanni Tropea",
            destination: "Milan",
          });
        status.should.equal(404);
        body.should.have.property("error");
      });
      it("Reserve a car unsuccessfully because of missing body parameter", async () => {
        const { status, body } = await request(app)
          .post(`/reservations/?token=${tokenList[index]}`)
          .set("Accept", "application/json")
          .send({ car_id:"ECHO-01", destination: "Milan" });
        status.should.equal(400);
        body.should.have.property("errors");
      });
    });
    describe("Delete", () => {
      it("Delete a reservation successfully", async () => {
        simulateReservation();
        const { status, body } = await request(app)
          .delete(
            `/reservations/${bookingList[0].reservationCode}/?token=${tokenList[index]}`
          )
          .set("Accept", "application/json");
        cars[0].available.should.be.true;
        body.should.have.property("message");
        status.should.equal(201);
      });
      it("Delete a reservation unsuccessfully cause of wrong reservationID", async () => {
        simulateReservation();
        const { status, body } = await request(app)
          .delete(`/reservations/111111/?token=${tokenList[index]}`)
          .set("Accept", "application/json");
        body.should.have.property("error");
        cars[0].available.should.be.false;
        status.should.equal(404);
      });
    });
  });
  describe("Vote", () => {
    const vote = {
      car_id: "ECHO-01",
      userName: "Giovanni",
      vote: 1,
    };
    it("Vote a driver successfully and update relative ranking", async () => {
      const { status } = await request(app)
        .post(`/cars/votes/?token=${tokenList[index]}`)
        .set("Accept", "application/json")
        .send(vote);
      status.should.equal(201);
      cars[0].votes.should.have.lengthOf(1);
      cars[0].ranking.should.not.be.NaN;
    });
    describe("Vote more times", () => {
      before(() => async () => {
        await request(app)
          .post(`/cars/votes/`)
          .set("Accept", "application/json")
          .send(vote);
      });
      it("Vote a driver successfully for the second time and update relative ranking", async () => {
        const { status, body } = await request(app)
          .post(`/cars/votes/?token=${tokenList[index]}`)
          .set("Accept", "application/json")
          .send({ car_id: "ECHO-01", userName: "Pippo", vote: 5 });
        status.should.equal(201);
        cars[0].votes.should.have.lengthOf(2);
        cars[0].ranking.should.not.be.NaN;
        cars[0].ranking.should.be.equal((cars[0].votes.reduce((acc, curr) => acc.vote + curr.vote)) / cars[0].votes.length)
        body.should.have.property("message");
      });
    });
    describe("Vote unsuccessfully wrond userID", () => {
      before(() => {
        cars[0].votes = [];
        cars[0].ranking = 0;
      });
      it("Vote a driver unsuccessfully cause of wrong car_id", async () => {
        const { status, body } = await request(app)
          .post(`/cars/votes/?token=${tokenList[index]}`)
          .set("Accept", "application/json")
          .send({ car_id: "ECHO-11", userName: "Giovanni", vote: 1 });
        status.should.equal(404);
        cars[0].votes.should.have.lengthOf(0);
        cars[0].ranking.should.equal(0);
        body.should.have.property("error");
      });
    });
  });
  describe("Route pricing", () => {
    it("Calculate route pricing", async () => {
      const { status, body } = await request(app)
        .get(`/prices/11/10/30/40/?token=${tokenList[index]}`)
        .set("Accept", "application/json");
      status.should.equal(200);
      body.should.have.property("message");
    });
    describe("Rate unsuccessfully", () => {
      it("Calculate route pricing putting a NaN", async () => {
        const { status, body } = await request(app)
          .get(`/prices/hello/2/13/22/?token=${tokenList[index]}`)
          .set("Accept", "application/json");
        status.should.equal(400);
        body.should.have.property("errors");
      });
      it("Calculate route pricing putting a NaN as third param", async () => {
        const { status, body } = await request(app)
          .get(`/prices/2/2/hello/22/?token=${tokenList[index]}`)
          .set("Accept", "application/json");
        status.should.equal(400);
        body.should.have.property("errors");
      });
    });
  });
});
