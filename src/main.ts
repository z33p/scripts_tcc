import ConnectionService from "./ConnectionService";

async function main() {
    const connService = new ConnectionService();

    const conn = await connService.establishConnection();

    console.log("hello world")
}

main();