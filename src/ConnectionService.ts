import { Connection } from "@solana/web3.js";
import fs from 'mz/fs';
import os from "os";
import path from "path";
import yaml from "yaml";

class ConnectionService {
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
}

export default ConnectionService; 