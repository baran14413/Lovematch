/**
 * =========================================================================
 *  LOVEMATCH CLONE - FIREBASE CORE
 *  PocketBase sistemi tamamen kaldırıldı. 
 *  Geriye dönük uyumluluk için 'pb' ismi korunmaktadır ancak tüm sistem
 *  Firebase Firestore/Storage üzerinden çalışmaktadır.
 * =========================================================================
 */
import { pb as firebasePb } from './firebase-adapter';

export const pb = firebasePb;
export default pb;
