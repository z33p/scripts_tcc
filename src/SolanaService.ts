import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import fs from 'mz/fs';
import os from "os";
import path from "path";
import yaml from "yaml";

class SolanaService {
  private async getConfig(): Promise<any> {
    // Path to Solana CLI config file
    const CONFIG_FILE_PATH = path.resolve(
      os.homedir(),
      '.config',
      'solana',
      'cli',
      'config.yml',
    );
    const configYml = await fs.readFile(CONFIG_FILE_PATH, { encoding: 'utf8' });
    return yaml.parse(configYml);
  }

  /**
   * Load and parse the Solana CLI config file to determine which RPC url to use
   */
  private async getRpcUrl(): Promise<string> {
    try {
      const config = await this.getConfig();
      if (!config.json_rpc_url) throw new Error('Missing RPC URL');
      return config.json_rpc_url;
    } catch (err) {
      console.warn(
        'Failed to read RPC url from CLI config file, falling back to localhost',
      );
      return 'http://127.0.0.1:8899';
    }
  }

  /**
   * Load and parse the Solana CLI config file to determine which payer to use
   */
  async getPayer(): Promise<Keypair> {
    try {
      const config = await this.getConfig();
      if (!config.keypair_path) throw new Error('Missing keypair path');
      return await this.createKeypairFromFile(config.keypair_path);
    } catch (err) {
      console.warn(
        'Failed to create keypair from CLI config file, falling back to new random keypair',
      );
      return Keypair.generate();
    }
  }

  /**
   * Create a Keypair from a secret key stored in file as bytes' array
   */
  async createKeypairFromFile(
    filePath: string,
  ): Promise<Keypair> {
    const secretKeyString = await fs.readFile(filePath, { encoding: 'utf8' });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
  }

  /**
   * Establish a connection to the cluster
   */
  async establishConnection(): Promise<Connection> {
    const rpcUrl = await this.getRpcUrl();
    const conn = new Connection(rpcUrl, 'confirmed');

    const version = await conn.getVersion();
    console.log('Connection to cluster established:', rpcUrl, version);

    return conn;
  }

  /**
   * Establish an account to pay for everything
   */
  async establishPayer(conn: Connection, dataLength: number): Promise<Keypair> {
    const { feeCalculator } = await conn.getRecentBlockhash();

    // Calculate the cost to fund the greeter account
    let fees = await conn.getMinimumBalanceForRentExemption(dataLength);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag
    console.log("Fee cost: ", fees);

    const payer = await this.getPayer();

    let lamports = await conn.getBalance(payer.publicKey);
    if (lamports < fees) {
      // If current balance is not enough to pay for fees, request an airdrop
      const sig = await conn.requestAirdrop(
        payer.publicKey,
        fees - lamports,
      );

      await conn.confirmTransaction(sig);

      lamports = await conn.getBalance(payer.publicKey);
    }

    console.log(
      'Using account',
      payer.publicKey.toBase58(),
      'containing',
      lamports / LAMPORTS_PER_SOL,
      'SOL to pay for fees',
    );

    return payer;
  }

  async checkProgram(conn: Connection, programSoPath: string, programKeyPairPath: string): Promise<PublicKey> {
    // Read program id from keypair file
    let programId: PublicKey;

    try {
      const programKeypair = await this.createKeypairFromFile(programKeyPairPath);
      programId = programKeypair.publicKey;
    } catch (err) {
      const errMsg = (err as Error).message;

      throw new Error(
        `Failed to read program keypair at '${programKeyPairPath}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/program.so\``,
      );
    }

    // Check if the program has been deployed
    const programInfo = await conn.getAccountInfo(programId);
    if (programInfo === null) {
      if (fs.existsSync(programSoPath)) {
        throw new Error(
          'Program needs to be deployed with `solana program deploy dist/program/program.so`',
        );
      } else {
        throw new Error('Program needs to be built and deployed');
      }
    } else if (!programInfo.executable) {
      throw new Error(`Program is not executable`);
    }

    return programId;
  }
}

export default SolanaService;