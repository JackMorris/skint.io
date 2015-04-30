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

function ViewModel() {
    this.grossSalary = ko.observable().extend({currency: {}});
    this.incomeTax = ko.computed(function() {
        console.log(this.grossSalary());
        var personalAllowance = 1060000 - Math.max(this.grossSalary() - 10000000, 0)*200;
        var taxableIncome = Math.max(this.grossSalary() - personalAllowance, 0);
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
    }, this);
    this.nationalInsurance = ko.computed(function() {
        var personalAllowance = 806000;
        var taxableIncome = Math.max(this.grossSalary() - personalAllowance, 0);
        if (taxableIncome <= 3432000) {
            // 12% band.
            return taxableIncome * 0.12;
        } else {
            // 2% band.
            return (taxableIncome - 3432000)*0.02 + 411840;
        }
    }, this);
    this.studentLoan = ko.computed(function() {
        return Math.max(this.grossSalary() - 2100000, 0)*0.09;
    }, this);
    this.netIncome = ko.computed(function() {
        return this.grossSalary() - this.incomeTax() - this.nationalInsurance() - this.studentLoan();
    }, this);
    this.netMonthlyIncome = ko.computed(function() {
        return this.netIncome() / 12;
    }, this);
    this.monthlyExpenses = ko.computed(function() {
        return 0;
    }, this);
    this.monthlyRemaining = ko.computed(function() {
        return this.netMonthlyIncome() - this.monthlyExpenses();
    }, this);
}

ko.applyBindings(new ViewModel());
