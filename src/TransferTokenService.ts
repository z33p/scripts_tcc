import { createMint, getOrCreateAssociatedTokenAccount, mintTo, transfer } from '@solana/spl-token';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import SolanaService from './SolanaService';

export async function transferTokenUseCase() {
    const solanaService = new SolanaService();
    const conn = await solanaService.establishConnection();

    // Generate a new wallet keypair and airdrop SOL
    const fromWallet = Keypair.generate();
    console.log(`Keypair generated to send tokens ${fromWallet.publicKey.toBase58()}`);

    console.log(`Generating ${LAMPORTS_PER_SOL} lamports to ${fromWallet.publicKey.toBase58()}`);
    const fromAirdropSignature = await conn.requestAirdrop(fromWallet.publicKey, LAMPORTS_PER_SOL);

    // Wait for airdrop confirmation
    console.log("Waiting to confirm transaction...");
    await conn.confirmTransaction(fromAirdropSignature);
    console.log("Transaction confirmed successfully!");

    // Generate a new wallet to receive newly minted token
    const toWallet = Keypair.generate();
    console.log(`Wallet generated to receive tokens ${toWallet.publicKey.toBase58()}`);

    // Create new token mint
    const mint = await createMint(conn, fromWallet, fromWallet.publicKey, null, 9);
    console.log(`New token minted ${mint.toBase58()}`)

    // Get the token account of the fromWallet address, and if it does not exist, create it
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        conn,
        fromWallet,
        mint,
        fromWallet.publicKey
    );
    console.log(`GetOrCreate account to send tokens ${fromTokenAccount.address.toBase58()}`);

    // Get the token account of the toWallet address, and if it does not exist, create it
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(conn, fromWallet, mint, toWallet.publicKey);
    console.log(`GetOrCreate account to receive tokens ${toTokenAccount.address.toBase58()}`);

    // Mint 1 new token to the "fromTokenAccount" account we just created
    let signature = await mintTo(
        conn,
        fromWallet,
        mint,
        fromTokenAccount.address,
        fromWallet.publicKey,
        LAMPORTS_PER_SOL
    );
    console.log(`Minting ${LAMPORTS_PER_SOL} new tokens to ${fromWallet.publicKey.toBase58()}`)
    console.log("Mint tx:", signature);

    // Transfer the new token to the "toTokenAccount" we just created
    signature = await transfer(
        conn,
        fromWallet,
        fromTokenAccount.address,
        toTokenAccount.address,
        fromWallet.publicKey,
        50
    );

    console.log("Transfering tokens...");
    await conn.confirmTransaction(signature);
    console.log("Transaction transfered successfully!");
}