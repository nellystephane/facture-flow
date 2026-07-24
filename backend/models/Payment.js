const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  montant: { type: Number, required: true },
  methode: {
    type: String,
    enum: ['especes', 'mtn_money', 'moov_money', 'carte', 'virement', 'autre'],
    default: 'especes'
  },
  date: { type: Date, default: Date.now },
  reference: { type: String, default: '' },
  note: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
