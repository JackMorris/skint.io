ko.extenders.currency = function (target) {

    // Currency string -> count of pence.
    var cleanInput = function (value) {
        var regex = /^£?(\d+)(\.(\d\d))?$/
        var match = regex.exec(value.replace(/,/g, ''));
        if (match) {
            var result = parseInt(match[1]) * 100;
            if (match[3] != undefined) {
                result += parseInt(match[3]);
            }
            return result;
        }
        return null;
    };

    // Count of pence -> currency string.
    var format = function (value) {
       return "£" + (value/100).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    // All we really do is add this 'formatted' thing, a secondary computed.
    target.formatted = ko.computed({
        read: function () {
            if (target() == null) {
                return null;
            }
            // Format raw value before returning it.
            return format(target());
        },
        write: function (value) {
            // Clean up input, and update raw if different.
            target(0);
            target(cleanInput(value));
        }
    }); 

    return target;
};

ko.bindingHandlers.currency = {
    update: function(element, valueAccessor, allBindingsAccessor) {
        return ko.bindingHandlers.text.update(element,function() {
            var value = +(ko.utils.unwrapObservable(valueAccessor()) || 0);
            return "£" + (value/100).toFixed(2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        });
    }
};

function MonthlyExpense() {
    this.name = ko.observable("");
    this.cost = ko.observable().extend({currency: {}});
}

function ViewModel() {
    var self = this;
    self.grossSalary = ko.observable().extend({currency: {}});
    self.calcEnabled = ko.computed(function() {
        return (self.grossSalary() != null);
    }, self);

    self.incomeTax = ko.computed(function() {
        var personalAllowance = 1060000 - Math.max(self.grossSalary() - 10000000, 0)*200;
        var taxableIncome = Math.max(self.grossSalary() - personalAllowance, 0);
        if (taxableIncome <= 3178500) {
            // 20% band.
            return taxableIncome*0.2;
        }
        else if (taxableIncome <= 15000000) {
            // 40% band.
            return (taxableIncome - 3178500)*0.4 + 635700;
        } else {
            // 45% band.
            return (taxableIncome - 15000000)*0.45 + 5364300;
        }
    }, self);
    self.nationalInsurance = ko.computed(function() {
        var personalAllowance = 806000;
        var taxableIncome = Math.max(self.grossSalary() - personalAllowance, 0);
        if (taxableIncome <= 3432000) {
            // 12% band.
            return taxableIncome * 0.12;
        } else {
            // 2% band.
            return (taxableIncome - 3432000)*0.02 + 411840;
        }
    }, self);
    self.studentLoan = ko.computed(function() {
        return Math.max(self.grossSalary() - 2100000, 0)*0.09;
    }, self);
    self.netIncome = ko.computed(function() {
        return self.grossSalary() - self.incomeTax() - self.nationalInsurance() - self.studentLoan();
    }, self);
    self.netMonthlyIncome = ko.computed(function() {
        return self.netIncome() / 12;
    }, self);
    self.monthlyExpenses = ko.observableArray([
        new MonthlyExpense()
    ]);
    self.totalMonthlyExpenses = ko.computed(function() {
        var total = 0;
        for (var i = 0; i < self.monthlyExpenses().length; i++) {
            var monthlyCost = self.monthlyExpenses()[i].cost();
            if (monthlyCost != null) {
                total += self.monthlyExpenses()[i].cost();
            }
        }
        return total;
    }, self);
    self.monthlyRemaining = ko.computed(function() {
        return self.netMonthlyIncome() - self.totalMonthlyExpenses();
    }, self);

    self.addExpense = function() {
        if (self.calcEnabled()) {
            self.monthlyExpenses.push(new MonthlyExpense());
        }
    };
    self.removeExpense = function(expense) {
        if (self.monthlyExpenses().length == 1) {
            self.monthlyExpenses()[0].name('');
            self.monthlyExpenses()[0].cost(null);
        } else {
            self.monthlyExpenses.remove(expense);
        }
    };
}

ko.applyBindings(new ViewModel());
